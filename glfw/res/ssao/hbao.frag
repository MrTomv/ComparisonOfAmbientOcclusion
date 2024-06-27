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
	float fov;
};

uniform  ParaOfHBAO Hbao;

const float PI = 3.14159265359;

// test
float vsZfromDepth(float d){
	d = d * 2.0 - 1.0;
	return -(2.0 * Hbao.near * Hbao.far) / (Hbao.far + Hbao.near - d * (Hbao.far - Hbao.near));
    //return -(2.0 * Hbao.near * Hbao.far) / (Hbao.far + Hbao.near - (2.0 * d - 1.0) * (Hbao.far - Hbao.near));
}

vec3 uvTovs(vec2 uv, float z){
	uv = uv * 2.0 - 1.0;
	uv.x = uv.x * tan(Hbao.fov / 2.0) * Hbao.screenSize.x / Hbao.screenSize.y  * z ;
	uv.y = uv.y * tan(Hbao.fov / 2.0)  * z ;
	return vec3(-uv, z);
}

vec3 getVP(vec2 uv){
	float depthInfo = texture(gPosition, uv).a;
	float z = vsZfromDepth(depthInfo);
	return uvTovs(uv, z);
}

// end
float linearDepth(float depth){
	float near = Hbao.near;
	float far = Hbao.far;
	return (2.0 * near) / (far + near - depth * (far - near));
	//return (near * far) / (far - depth * (far - near));
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
	//vec3 vp = calViewPos(TexCoords);
	vec3 vp = getVP(TexCoords);
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

/*
#version 460

out float FragColor;
in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D texNoise;

struct ParaOfHBAO {
    vec2 screenSize;
    float radius;
    float bias;
    int directions;
    int steps;
    float near;
    float far;
    float fov;
    float aoStrength;
    float maxRadiusPixels;
    vec2 focalLen;
};

uniform ParaOfHBAO Hbao;

const float PI = 3.14159265359;

float ViewSpaceZFromDepth(float d)
{
    d = d * 2.0 - 1.0;
    return -(2.0 * Hbao.near * Hbao.far) / (Hbao.far + Hbao.near - d * (Hbao.far - Hbao.near));
}

vec3 UVToViewSpace(vec2 uv, float z)
{
    uv = uv * 2.0 - 1.0;
    uv.x = uv.x * tan(Hbao.fov / 2.0) * Hbao.screenSize.x / Hbao.screenSize.y * z;
    uv.y = uv.y * tan(Hbao.fov / 2.0) * z;
    return vec3(-uv, z);
}

vec3 GetViewPos(vec2 uv)
{
    float z = ViewSpaceZFromDepth(texture(gPosition, uv).a);
    return UVToViewSpace(uv, z);
}

float TanToSin(float x)
{
    return x * inversesqrt(x*x + 1.0);
}

float InvLength(vec2 V)
{
    return inversesqrt(dot(V,V));
}

float Tangent(vec3 V)
{
    return V.z * InvLength(V.xy);
}

float BiasedTangent(vec3 V)
{
    return V.z * InvLength(V.xy) + tan(30.0 * PI / 180.0);
}

float Length2(vec3 V)
{
    return dot(V,V);
}

vec2 RotateDirections(vec2 Dir, vec2 CosSin)
{
    return vec2(Dir.x*CosSin.x - Dir.y*CosSin.y,
                Dir.x*CosSin.y + Dir.y*CosSin.x);
}

float Falloff(float d2)
{
    return d2 * (-1.0 / (Hbao.radius * Hbao.radius)) + 1.0;
}

float HorizonOcclusion(vec2 deltaUV, vec3 P, vec3 N, float randstep, float numSamples)
{
    float ao = 0;
    vec2 uv = TexCoords;
    float tanH = BiasedTangent(N);
    float sinH = TanToSin(tanH);

    for(float s = 1; s <= numSamples; ++s)
    {
        uv += deltaUV;
        vec3 S = GetViewPos(uv);
        vec3 V = S - P;
        float tanS = Tangent(V);
        float d2 = Length2(V);

        if(d2 < (Hbao.radius * Hbao.radius) && tanS > tanH)
        {
            float sinS = TanToSin(tanS);
            ao += Falloff(d2) * (sinS - sinH);
            tanH = tanS;
            sinH = sinS;
        }
    }

    return ao;
}

void ComputeSteps(inout vec2 stepSizeUv, inout float numSteps, float rayRadiusPix, float rand)
{
    numSteps = min(float(Hbao.steps), rayRadiusPix);

    float stepSizePix = rayRadiusPix / (numSteps + 1);
    FragColor = stepSizePix / Hbao.screenSize.x; // 归一化步长
    return;
    float maxNumSteps = Hbao.maxRadiusPixels / stepSizePix;
    if (maxNumSteps < numSteps)
    {
        numSteps = floor(maxNumSteps + rand);
        numSteps = max(numSteps, 1);
        stepSizePix = Hbao.maxRadiusPixels / numSteps;
    }

    stepSizeUv = stepSizePix * vec2(1.0 / Hbao.screenSize.x, 1.0 / Hbao.screenSize.y);

}

void main()
{

    vec2 NoiseScale = vec2(Hbao.screenSize.x/4.0, Hbao.screenSize.y/4.0);
    vec3 P = GetViewPos(TexCoords);
    vec3 N = normalize(texture(gNormal, TexCoords).xyz);
    vec3 random = texture(texNoise, TexCoords * NoiseScale).rgb;

    vec2 rayRadiusUV = 0.5 * Hbao.radius * Hbao.focalLen / -P.z;
    float rayRadiusPix = rayRadiusUV.x * Hbao.screenSize.x;



    float ao = 1.0;
    float numSteps;
    vec2 stepSizeUV;

    if(rayRadiusPix > 1.0)
    {
        ao = 0.0;
        ComputeSteps(stepSizeUV, numSteps, rayRadiusPix, random.z);

        for(int i = 0; i < Hbao.directions; ++i)
        {
            float angle = (float(i) / float(Hbao.directions)) * 2.0 * PI;
            vec2 dir = RotateDirections(vec2(cos(angle), sin(angle)), random.xy);
            vec2 deltaUV = dir * stepSizeUV;

            ao += HorizonOcclusion(deltaUV, P, N, random.z, numSteps);
        }

        ao = 1.0 - ao / float(Hbao.directions) * Hbao.aoStrength;
    }

    FragColor = ao;

}


#version 460
out float FragColor;
in vec2 TexCoords;
uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform mat4 projection;

struct ParaOfHBAO {
    vec2 screenSize;
    float radius;
    float maxRadiusPixels;
    float bias;
    int directions;
    int steps;
    float near;
    float far;
    float fov;
};
uniform ParaOfHBAO Hbao;

const float PI = 3.14159265359;
const vec2 noiseScale = vec2(1280.0/4.0, 720.0/4.0); 

vec3 getViewPos(vec2 uv) {
    float depth = texture(gPosition, uv).a;
    
    // 将深度值转换到 NDC 空间 [-1, 1]
    float z = depth * 2.0 - 1.0;
    
    // 重建裁剪空间位置
    vec4 clipSpacePosition = vec4(uv * 2.0 - 1.0, z, 1.0);
    
    // 转换到视图空间
    vec4 viewSpacePosition = inverse(projection) * clipSpacePosition;
    
    // 执行透视除法
    viewSpacePosition /= viewSpacePosition.w;
    
    return viewSpacePosition.xyz;
}

float getHorizonAngle(vec3 P, vec3 N, vec2 direction, float radius) {
    float maxHorizonAngle = -1.0;
    
    for (int i = 1; i <= Hbao.steps; i++) {
        float t = float(i) / float(Hbao.steps);
        vec2 sampleUV = TexCoords + direction * t * radius / P.z;
        
        if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
            break;
        }
        
        vec3 S = getViewPos(sampleUV);
        vec3 V = S - P;
        float VdotV = dot(V, V);
        float NdotV = dot(N, V) * inversesqrt(VdotV);
        
        maxHorizonAngle = max(maxHorizonAngle, NdotV);
    }
    
    return maxHorizonAngle;
}

void main() {
    vec3 P = getViewPos(TexCoords);
    vec3 N = normalize(texture(gNormal, TexCoords).rgb * 2.0 - 1.0);
    
    float aoSum = 0.0;
    float radiusPixels = Hbao.radius * Hbao.screenSize.y / P.z;
    
    for (int i = 0; i < Hbao.directions; i++) {
        float angle = PI * 2.0 * float(i) / float(Hbao.directions);
        vec2 direction = vec2(cos(angle), sin(angle));
        
        float horizonAngle = getHorizonAngle(P, N, direction, radiusPixels);
        float horizonAngleNeg = getHorizonAngle(P, N, -direction, radiusPixels);
        
        aoSum += max(0.0, horizonAngle + horizonAngleNeg - Hbao.bias);
    }
    
    float ao = 1.0 - aoSum / (PI * float(Hbao.directions));
    ao = clamp(ao, 0.0, 1.0);
    
    FragColor = ao;
}
*/