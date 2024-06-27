/*
#version 460

out float FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D u_NoiseTexture;

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
	vec2 focalLen;
};
uniform  ParaOfHBAO Hbao;

const float PI = 3.14159265359;
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec3 getViewPos(vec2 uv) {
    vec4 pos = texture(gPosition, uv);
    float depth = pos.a;
    vec3 viewPos = vec3(uv * 2.0 - 1.0, depth);
    viewPos.xy *= viewPos.z * tan(Hbao.fov * 0.5) / Hbao.focalLen;
    return viewPos;
}

vec3 getViewNormal(vec2 uv) {
    return normalize(texture(gNormal, uv).xyz);
}

float linearizeDepth(float depth) {
    float z = depth * 2.0 - 1.0; 
    return (2.0 * Hbao.near * Hbao.far) / (Hbao.far + Hbao.near - z * (Hbao.far - Hbao.near));
}

void main() {
    vec2 texelSize = 1.0 / Hbao.screenSize;
    vec3 viewPos = getViewPos(TexCoords);
    vec3 viewNormal = getViewNormal(TexCoords);

    float occlusion = 0.0;
    
    for (int i = 0; i < Hbao.directions; ++i) {
        float angle = PI * 2.0 * (float(i) + rand(TexCoords)) / float(Hbao.directions);
        vec2 dir = vec2(cos(angle), sin(angle));
        
        float rayPixels = min(Hbao.radius / viewPos.z, Hbao.maxRadiusPixels);
        
        float stepSizePixels = rayPixels / float(Hbao.steps);
        vec2 stepSizeUV = stepSizePixels * texelSize;

        float horizonAngle = 0.0;
        
        for (int j = 1; j <= Hbao.steps; ++j) {
            vec2 sampleUV = TexCoords + dir * stepSizeUV * float(j);
            vec3 sampleViewPos = getViewPos(sampleUV);
            
            vec3 sampleDir = sampleViewPos - viewPos;
            float sampleDist = length(sampleDir);
            float sampleAngle = dot(normalize(sampleDir), viewNormal) - Hbao.bias;
            
            if (sampleAngle > horizonAngle) {
                float delta = sin(sampleAngle) - sin(horizonAngle);
                horizonAngle = sampleAngle;
                float attenuation = 1.0 - pow(sampleDist / Hbao.radius, 2.0);
                occlusion += attenuation * delta;
            }
        }
    }
    
    occlusion = 1.0 - occlusion / float(Hbao.directions);
    FragColor = occlusion;
}
*/

#version 460

const float PI = 3.14159265;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D texNoise;

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
    vec2 focalLen;
    float aoStrength;
};

uniform ParaOfHBAO hbao;

in vec2 TexCoords;
out float FragColor;

// 预计算的常量，可以在CPU端计算后传入，或在这里计算
const float R = 300;
const float R2 = R * R;
const float NegInvR2 = -1.0 / R2;
const float TanBias = tan(30 * PI / 180.0);

vec3 GetViewPos(vec2 uv)
{
    return texture(gPosition, uv).xyz;
}

vec3 GetViewNormal(vec2 uv)
{
    return normalize(texture(gNormal, uv).xyz);
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
    return V.z * InvLength(V.xy) + TanBias;
}

float Length2(vec3 V)
{
    return dot(V,V);
}

vec2 SnapUVOffset(vec2 uv)
{
    return round(uv * hbao.screenSize) / hbao.screenSize;
}

float Falloff(float d2)
{
    return d2 * NegInvR2 + 1.0f;
}

float HorizonOcclusion(vec2 deltaUV, vec3 P, vec3 N, vec3 dPdu, vec3 dPdv, float randstep, float numSamples)
{
    float ao = 0;
    vec2 uv = TexCoords + SnapUVOffset(randstep*deltaUV);
    deltaUV = SnapUVOffset(deltaUV);
    vec3 T = deltaUV.x * dPdu + deltaUV.y * dPdv;
    float tanH = BiasedTangent(T);
    float sinH = TanToSin(tanH);
    float tanS;
    float d2;
    vec3 S;

    for(float s = 1; s <= numSamples; ++s)
    {
        uv += deltaUV;
        S = GetViewPos(uv);
        vec3 V = S - P;
        float VdotV = dot(V, V);
        float NdotV = dot(N, V) * inversesqrt(VdotV);

        if(VdotV < R2 && NdotV > 0)
        {
            float attenuation = Falloff(VdotV);
            tanS = Tangent(V);
            if (tanS > tanH)
            {
                float sinS = TanToSin(tanS);
                ao += attenuation * (sinS - sinH);
                tanH = tanS;
                sinH = sinS;
            }
        }
    }
    
    return ao;
}

vec2 RotateDirections(vec2 Dir, vec2 CosSin)
{
    return vec2(Dir.x*CosSin.x - Dir.y*CosSin.y,
                Dir.x*CosSin.y + Dir.y*CosSin.x);
}

void ComputeSteps(inout vec2 stepSizeUv, inout float numSteps, float rayRadiusPix, float rand)
{
    numSteps = min(hbao.steps, rayRadiusPix);

    float stepSizePix = rayRadiusPix / (numSteps + 1);

    float maxNumSteps = hbao.maxRadiusPixels / stepSizePix;
    if (maxNumSteps < numSteps)
    {
        numSteps = floor(maxNumSteps + rand);
        numSteps = max(numSteps, 1);
        stepSizePix = hbao.maxRadiusPixels / numSteps;
    }

    //stepSizeUv = stepSizePix / hbao.screenSize;
    stepSizeUv = stepSizePix * vec2(1.0 / hbao.screenSize.x,1.0 / hbao.screenSize.y);
}

void main()
{
    vec2 NoiseScale = hbao.screenSize / 4.0f;
    float numDirections = hbao.directions;

    vec3 P = GetViewPos(TexCoords);
    vec3 N = GetViewNormal(TexCoords);

    vec3 Pr = GetViewPos(TexCoords + vec2(1.0, 0) / hbao.screenSize);
    vec3 Pl = GetViewPos(TexCoords + vec2(-1.0, 0) / hbao.screenSize);
    vec3 Pt = GetViewPos(TexCoords + vec2(0, 1.0) / hbao.screenSize);
    vec3 Pb = GetViewPos(TexCoords + vec2(0, -1.0) / hbao.screenSize);
    
    vec3 dPdu = (Pr - Pl) * 0.5;
    vec3 dPdv = (Pt - Pb) * 0.5 * (hbao.screenSize.y * 1.0/ hbao.screenSize.x);

    vec3 random = texture(texNoise, TexCoords.xy * NoiseScale).rgb;
    vec2 rayRadiusUV = 0.5 * R * hbao.focalLen / -P.z;
    float rayRadiusPix = rayRadiusUV.x * hbao.screenSize.x;
    float ao = 1.0;
    float numSteps ;
    vec2 stepSizeUV ;
    
    if(rayRadiusPix > 1.0)
    {
        ao = 0.0;
        ComputeSteps(stepSizeUV, numSteps, rayRadiusPix, random.z);
        float alpha = 2.0 * PI / numDirections;
        
        for(float d = 0; d < numDirections; ++d)
        {
            float theta = alpha * d;
            vec2 dir = RotateDirections(vec2(cos(theta), sin(theta)), random.xy);
            vec2 deltaUV = dir * stepSizeUV;
            ao += HorizonOcclusion(deltaUV, P, N, dPdu, dPdv, random.z, numSteps);
        }
        
        ao = 1.0 - ao / numDirections * hbao.aoStrength;
    }
    
    FragColor = ao;
}