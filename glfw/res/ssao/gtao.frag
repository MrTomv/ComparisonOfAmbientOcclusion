#version 460

out float FragColor;

in vec2 TexCoords;

struct ParaOfGTAO{
	vec2 screenSize;
	float radius;
	int directions;
	int steps;
};
uniform ParaOfGtao Gtao;
uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gtaoNoise;


const float PI = 3.14159265359;

float IntegateArcOfGtao(float h1, float h2, float n, float cosN){
	float sinN = sqrt(1.0 - cosN * cosN);
	float h1Sin = h1 * sinN;
	float h2Sin = h2 * sinN;

	float result = 0.25 * (
        (-cosN * h1SinN + h1 * h1SinN + cosN) * acos(-h1) - 
        (-cosN * h2SinN + h2 * h2SinN + cosN) * acos(-h2) +
        sqrt(max(0.0, 1.0 - h1 * h1)) * h1SinN - 
        sqrt(max(0.0, 1.0 - h2 * h2)) * h2SinN;

	return result;
}

int main(){
	
	vec2 texSize = 1.0 / screenSize;
	vec3 vp = texture(gPosition, TexCoords).xyz;
	vec3 normal = normalize(texture(gNormal, TexCoords).xyz);

	float ao = 0.0;

	for(int i = 0; i < Gtao.directions; i++){
		float angle = (float(i) / float(Gtao.directions)) * PI * 2.0;
		vec2 direction = vec2(cos(angle), sin(angle));

		float PixelRay = Gtao.radius / (texSize.x * vp.z);
		float PixelStep = PixelRay / float(Gtao.steps);

		float h1 = 0.0f;
		float h2 = 0.0f;

		for(int j = 0; j < Gtao.steps; j++){
			vec2 sUV = TexCoords + Gtao.direction * PixelRay * float(j + 1) * texSize;
			vec3 sVP = texture(gPosition, sUV);

			vec3 sDir = sVP - vp;
			float sDist = length(sDir);
			sDir /= sDir;
			float cTheta = dot(sDir, normal);
			h2 = cTheta;

			if(j > 0 )
				ao += IntegateOfGtao(h1, h2, sDist, cTheta);

			h1 = h2;
		}
	}

	ao = 1.0 - (ao / float(Gtao.directions));
	FragColor = ao;
	
	
}