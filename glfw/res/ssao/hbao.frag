#version 460

out float FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;

struct ParaOfHBAO{
	vec2 screenSize;
	float radius;
	float maxRadiusPixels;
	float bias;
	int directions;
	int steps;
	float near;
	float far;
};

uniform  ParaOfHBAO Hbao;

const float PI = 3.14159265359;

float linearDepth(float depth){
	float near = Hbao.near;
	float far = Hbao.far;
	return (2.0 * near) / (far + near - depth * (far - near));
}

vec3 calViewPos(vec2 uv){
	vec4 depthInfo = texture(gPosition, uv);
	float depth = depthInfo.a;
	float ld = linearDepth(depth);
	return vec3((uv * 2.0 - 1.0) * ld, ld);
}

float calHorizonAngle(vec3 viewPos, vec2 uv, vec3 normal){
	float maxAngle = -1.f;
	for(int i = 1; i <= Hbao.steps; i++){
		vec2 sUV = uv + uv * float(i);
		vec3 sViewPos = calViewPos(sUV);
		vec3 sDir = normalize(sViewPos - viewPos);

		float angle = dot(sDir, normal);
		maxAngle = max(maxAngle, angle);
	}

	return maxAngle;
}

void main(){
	vec3 vp = calViewPos(TexCoords);
	vec3 vn = normalize(texture(gNormal, TexCoords).xyz);
	float aoSum = 0.0f;

	for(int i = 0; i < Hbao.directions; i++){
		float angle = (float(i) / float(Hbao.directions)) * 2.0 * PI;
		vec2 uv = vec2(cos(angle), sin(angle)) * Hbao.radius/ Hbao.screenSize;
		
		float angleA = calHorizonAngle(vp, uv, vn);
		float angleB = calHorizonAngle(vp, -uv, vn);

		aoSum += max(0.0, dot(vn, vec3(uv, angleA)) + dot(vn, vec3(-uv, angleB)));
	}
	float ao = 1.0 - aoSum / (2.0 * PI * float(Hbao.directions));

	FragColor = ao;
}