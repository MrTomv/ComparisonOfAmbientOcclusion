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
    float con1;
    float con2;
    float con3;
    float con4;
};

uniform ParaOfHBAO hbao;

in vec2 TexCoords;
out float FragColor;

/*
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
    return V.z * inversesqrt(dot(V,V));// InvLength(V.xy);
}

float BiasedTangent(vec3 V)
{
    return V.z * inversesqrt(dot(V,V))+ hbao.con4; // InvLength(V.xy) ;
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
    return d2 * hbao.con3 + 1.0f;
}
*/
float HorizonOcclusion(vec2 deltaUV, vec3 P, vec3 N, vec3 dPdu, vec3 dPdv, float randstep, float numSamples)
{
    float ao = 0;
    vec2 a = randstep * deltaUV;
    vec2 uv = TexCoords + round(a * hbao.screenSize) / hbao.screenSize; // SnapUVOffset(randstep*deltaUV);

    deltaUV = round(deltaUV * hbao.screenSize) / hbao.screenSize; //SnapUVOffset(deltaUV);
    vec3 T = deltaUV.x * dPdu + deltaUV.y * dPdv;
    float tanH =  T.z * inversesqrt(dot(T,T))+ hbao.con4;  //BiasedTangent(T);
    float sinH =  tanH * inversesqrt(pow(tanH, 2) + 1.0); //TanToSin(tanH);
    float tanS;
    float d2;
    vec3 S;

    for(float s = 1; s <= numSamples; ++s)
    {
        uv += deltaUV;
        S = texture(gPosition, uv).xyz;
        vec3 V = S - P;
        float VdotV = dot(V, V);
        float NdotV = dot(N, V) * inversesqrt(VdotV);

        if(VdotV < hbao.con2 && NdotV > 0)
        {
            float attenuation = VdotV * hbao.con3 + 1.0f; //Falloff(VdotV);
            tanS = V.z * inversesqrt(dot(V,V)); //Tangent(V);
            if (tanS > tanH)
            {
                float sinS = tanS * inversesqrt(pow(tanS, 2) + 1.0);// TanToSin(tanS);
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

    vec3 P = texture(gPosition, TexCoords).xyz;//GetViewPos(TexCoords);
    vec3 N =  normalize(texture(gNormal, TexCoords).xyz); // GetViewNormal(TexCoords);
    //texture(gPosition, uv).xyz;

    vec2 right = TexCoords + vec2(1.0, 0) / hbao.screenSize;
    vec2 left = TexCoords + vec2(-1.0, 0) / hbao.screenSize;
    vec2 top = TexCoords + vec2(0, 1.0) / hbao.screenSize;
    vec2 bottom = TexCoords + vec2(0, -1.0) / hbao.screenSize;

    vec3 Pr = texture(gPosition, right).xyz;
    vec3 Pl = texture(gPosition, left).xyz;
    vec3 Pt = texture(gPosition, top).xyz;
    vec3 Pb = texture(gPosition, bottom).xyz;
    
    vec3 dPdu = (Pr - Pl) * 0.5;
    vec3 dPdv = (Pt - Pb) * 0.5 * (hbao.screenSize.y * 1.0/ hbao.screenSize.x);

    vec3 random = texture(texNoise, TexCoords.xy * NoiseScale).rgb;
    vec2 rayRadiusUV = 0.5 * hbao.con1 * hbao.focalLen / -P.z;
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