/*
#version 460

out float FragColor;

in vec2 TexCoords;

struct ParaOfGTAO{
	vec2 screenSize;
	float radius;
	int steps;
	float fallOff;
	float thicknessMix;
	float noiseScale;
	float near;
    float far;
    float fov;
};

uniform ParaOfGTAO Gtao;
uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gtaoNoise;


const float PI = 3.14159265359;
const float aspect = Gtao.screenSize.x / Gtao.screenSize.y;
float GTAOArcos(float x){
	float res = -0.156583 * abs(x) + PI/2;
	res *= sqrt(1.0 - abs(x));
	return x >= 0 ? res : PI - res;
}

float IntegrateArc(float h1, float h2, float n){
	float cosN = cos(n);
	float sinN = sin(n);

	return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN
                   -cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}

float ViewSpaceZFromDepth(float d) {
    d = d * 2.0 - 1.0;
    return -(2.0 * Gtao.near * Gtao.far) / (Gtao.far + Gtao.near - d * (Gtao.far - Gtao.near));
}

vec3 UVToViewSpace(vec2 uv, float z) {
    uv = uv * 2.0 - 1.0;
    uv.x = uv.x * tan(Gtao.fov / 2.0) * Gtao.screenSize.x / Gtao.screenSize.y * z;
    uv.y = uv.y * tan(Gtao.fov / 2.0) * z;
    return vec3(-uv, z);
}

vec3 GetViewPos(vec2 uv) {
    float z = ViewSpaceZFromDepth(texture(gPosition, uv).a);
    return UVToViewSpace(uv, z);
}

void GtaoSample(vec2 tc_base, vec2 aoDir, int i, vec3 viewPos, vec3 viewNormal, inout float closest){
	vec2 uv = tc_base + aoDir * i;
    vec3 sampleViewPos = GetViewPos(uv);
    vec3 sampleVec = sampleViewPos - viewPos;
    float sampleDist = length(sampleVec);
    
    if (sampleDist < Gtao.radius) {
        float falloff = 1.0 - sampleDist / Gtao.radius;
        float NdotV = max(dot(viewNormal, normalize(sampleVec)), 0.0);
        float current = NdotV * Gtao.fallOff;
        
        closest = max(closest, current);
        closest = mix(closest, current, Gtao.thicknessMix * falloff);
    }
}

void main() {
    vec3 viewPos = GetViewPos(TexCoords);
    vec3 viewNormal = normalize(texture(gNormal, TexCoords).xyz);
    
    float noise = texture(gtaoNoise, TexCoords * Gtao.noiseScale).r;
    
    float dirAngle = noise * PI * 2.0;
    vec2 viewsizediv = 1.0 / Gtao.screenSize;

    vec2 aoDir = vec2(cos(dirAngle), sin(dirAngle)) * viewsizediv.xy * Gtao.radius / -viewPos.z;
    
    float c1 = 0.0, c2 = 0.0;
    
    for(int i = 1; i <= Gtao.steps; i++) {
        GtaoSample(TexCoords, aoDir, i, viewPos, viewNormal, c1);
        GtaoSample(TexCoords, -aoDir, i, viewPos, viewNormal, c2);
    }
    
    float n = GTAOArcos(viewNormal.z) - PI/2;
    float h1 = GTAOArcos(c1);
    float h2 = GTAOArcos(c2);
    
    float visibility = IntegrateArc(max(n - h1, -PI/2), min(n + h2, PI/2), n);
    
    FragColor = 1.0 - visibility;
}

#version 460
out float FragColor;
in vec2 TexCoords;

struct ParaOfGTAO {
    vec2 screenSize;
    float radius;
    int samples;
    float falloff;
    float thicknessMix;
    float noiseScale;
    float near;
    float far;
    float fov;
    float aspect;
};

uniform ParaOfGTAO Gtao;
uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler1D gtaoNoise;

#define PI 3.1415926535897932384626433832795
#define PI_HALF 1.5707963267948966192313216916398

float GTAOFastAcos(float x)
{
    float res = -0.156583 * abs(x) + PI_HALF;
    res *= sqrt(1.0 - abs(x));
    return x >= 0 ? res : PI - res;
}

float IntegrateArc(float h1, float h2, float n)
{
    float cosN = cos(n);
    float sinN = sin(n);
    return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN - cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}

vec3 GetCameraVec(vec2 uv)
{   
    return vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * Gtao.aspect - Gtao.aspect, 1.0);
}

// TEST
float ViewSpaceZFromDepth(float d)
{
    d = d * 2.0 - 1.0;
    return (2.0 * Gtao.near * Gtao.far) / (Gtao.far + Gtao.near - d * (Gtao.far - Gtao.near));
}

vec3 UVToViewSpace(vec2 uv, float z)
{
    uv = uv * 2.0 - 1.0;
    uv.x = uv.x * tan(Gtao.fov / 2.0) * Gtao.screenSize.x / Gtao.screenSize.y * z;
    uv.y = uv.y * tan(Gtao.fov / 2.0) * z;
    return vec3(-uv, z);
}

vec3 GetViewPos(vec2 uv)
{
    float z = ViewSpaceZFromDepth(texture(gPosition, uv).a);
    return UVToViewSpace(uv, z);
}

// END


void SliceSample(vec2 tc_base, vec2 aoDir, int i, vec3 ray, vec3 v, inout float closest)
{
    vec2 uv = tc_base + aoDir * i;
    vec3 p = GetViewPos(uv)  - ray;
    float current = dot(v, normalize(p));
    float falloff = clamp((Gtao.radius - length(p)) / Gtao.falloff, 0.0, 1.0);
    if(current > closest)
        closest = mix(closest, current, falloff);
    closest = mix(closest, current, Gtao.thicknessMix * falloff);
}

void main()
{   
    vec2 tc_original = TexCoords;
   
    vec3 ray = GetViewPos(tc_original) ;
    
    vec3 normal = normalize(texture(gNormal, tc_original).xyz);
    
    vec2 viewsizediv = 1.0 / Gtao.screenSize;
    float stride = min((1.0 / length(ray)) * Gtao.thicknessMix, Gtao.samples);
    vec2 dirMult = viewsizediv * stride;
    vec3 v = normalize(-ray);
    
    float noise = texture(gtaoNoise, gl_FragCoord.x * Gtao.noiseScale).r;
    float dirAngle = noise * PI * 2.0;
    vec2 aoDir = dirMult * vec2(sin(dirAngle), cos(dirAngle));
    
    vec3 toDir = GetViewPos(tc_original + aoDir);
    vec3 planeNormal = normalize(cross(v, -toDir));
    vec3 projectedNormal = normal - planeNormal * dot(normal, planeNormal);
    
    vec3 projectedDir = normalize(normalize(toDir) + v);
    float n = GTAOFastAcos(dot(-projectedDir, normalize(projectedNormal))) - PI_HALF;
    
    float c1 = -1.0;
    float c2 = -1.0;
    
    vec2 tc_base = tc_original + aoDir * (0.25 * ((int(gl_FragCoord.y) - int(gl_FragCoord.x)) & 3) - 0.375 + fract(noise * 13.0));
    
    for(int i = -1; i >= -Gtao.samples; i--)
    {
        SliceSample(tc_base, aoDir, i, ray, v, c1);
    }
    for(int i = 1; i <= Gtao.samples; i++)
    {
        SliceSample(tc_base, aoDir, i, ray, v, c2);
    }
    
    float h1a = -GTAOFastAcos(c1);
    float h2a = GTAOFastAcos(c2);
    
    float h1 = n + max(h1a - n, -PI_HALF);
    float h2 = n + min(h2a - n, PI_HALF);
    
    float visibility = mix(1.0, IntegrateArc(h1, h2, n), length(projectedNormal));

    FragColor = 1.0-  visibility;

}

*/
#version 460
out float FragColor;
in vec2 TexCoords;

struct ParaOfGTAO {
    vec2 screenSize;
    float radius;
    int samples;
    float falloff;
    float thicknessMix;
    float near;
    float far;
    float fov;
    float aspect;
};

uniform ParaOfGTAO Gtao;
uniform sampler2D gPosition;
uniform sampler2D gNormal;

#define PI 3.1415926535897932384626433832795
#define PI_HALF 1.5707963267948966192313216916398

float GTAOFastAcos(float x)
{
    float res = -0.156583 * abs(x) + PI_HALF;
    res *= sqrt(1.0 - abs(x));
    return x >= 0 ? res : PI - res;
}

float IntegrateArc(float h1, float h2, float n)
{
    float cosN = cos(n);
    float sinN = sin(n);
    return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN - cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}

float ViewSpaceZFromDepth(float d)
{
    d = d * 2.0 - 1.0;
    return (2.0 * Gtao.near * Gtao.far) / (Gtao.far + Gtao.near - d * (Gtao.far - Gtao.near));
}

vec3 UVToViewSpace(vec2 uv, float z)
{
    uv = uv * 2.0 - 1.0;
    uv.x = uv.x * tan(Gtao.fov / 2.0) * Gtao.screenSize.x / Gtao.screenSize.y * z;
    uv.y = uv.y * tan(Gtao.fov / 2.0) * z;
    return vec3(-uv, z);
}

vec3 GetViewPos(vec2 uv)
{
    float z = ViewSpaceZFromDepth(texture(gPosition, uv).a);
    return UVToViewSpace(uv, z);
}

void SliceSample(vec2 tc_base, vec2 aoDir, int i, vec3 ray, vec3 v, inout float closest)
{
    vec2 uv = tc_base + aoDir * i;
    vec3 p = GetViewPos(uv) - ray;
    float current = dot(v, normalize(p));
    float falloff = clamp((Gtao.radius - length(p)) / Gtao.falloff, 0.0, 1.0);
    if(current > closest)
        closest = mix(closest, current, falloff);
    closest = mix(closest, current, Gtao.thicknessMix * falloff);
}

void main()
{   
    vec2 tc_original = TexCoords;
   
    vec3 ray = GetViewPos(tc_original);
    vec3 normal = normalize(texture(gNormal, tc_original).xyz);
    
    vec2 viewsizediv = 1.0 / Gtao.screenSize;
    float stride = min((1.0 / length(ray)) * Gtao.thicknessMix, float(Gtao.samples));
    vec2 dirMult = viewsizediv * stride;
    vec3 v = normalize(-ray);
    
    // Deterministic direction calculation based on pixel position
    float dirAngle = (PI / 16.0) * (((int(gl_FragCoord.x) + int(gl_FragCoord.y) & 3) << 2) + (int(gl_FragCoord.x) & 3));
    vec2 aoDir = dirMult * vec2(sin(dirAngle), cos(dirAngle));
    
    vec3 toDir = GetViewPos(tc_original + aoDir) - ray;
    vec3 planeNormal = normalize(cross(v, toDir));
    vec3 projectedNormal = normal - planeNormal * dot(normal, planeNormal);
    
    vec3 projectedDir = normalize(normalize(toDir) + v);
    float n = GTAOFastAcos(dot(-projectedDir, normalize(projectedNormal))) - PI_HALF;
    
    float c1 = -1.0;
    float c2 = -1.0;
    
    // Deterministic offset based on pixel position
    vec2 tc_base = tc_original + aoDir * (0.25 * ((int(gl_FragCoord.y) - int(gl_FragCoord.x)) & 3) - 0.375);
    
    for(int i = -1; i >= -Gtao.samples; i--)
    {
        SliceSample(tc_base, aoDir, i, ray, v, c1);
    }
    for(int i = 1; i <= Gtao.samples; i++)
    {
        SliceSample(tc_base, aoDir, i, ray, v, c2);
    }
    
    float h1a = -GTAOFastAcos(c1);
    float h2a = GTAOFastAcos(c2);
    
    float h1 = n + max(h1a - n, -PI_HALF);
    float h2 = n + min(h2a - n, PI_HALF);
    
    float visibility = mix(1.0, IntegrateArc(h1, h2, n), length(projectedNormal));

    FragColor = 1.0 - visibility;
}
