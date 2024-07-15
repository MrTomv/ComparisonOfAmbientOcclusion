#version 460

out float FragColor;
in vec2 TexCoords;

struct ParaOfGTAO {
    vec2 screenSize;
    int steps; // samples
    float limit; // limit
    float stride; // max stride
    float radius; // radius;
    float fallOf; // fallof
    float thicknessMix;

};

uniform ParaOfGTAO Gtao;
uniform sampler2D gPosition;
uniform sampler2D gNormal;

#define PI 3.14159265
#define PI_HALF 1.57079632
const float aspect = Gtao.screenSize.x / Gtao.screenSize.y;
const vec2 viewSizeDiv = vec2(1.0 / Gtao.screenSize.x, 1.0 / Gtao.screenSize.y);
const float angleOffset = 0.1;
const float spacialOffset = 0.1;

float GTAOFastAcos(float x) {
    float res = -0.156583 * abs(x) + PI_HALF;
    res *= sqrt(1.0 - abs(x));
    return x >= 0 ? res : PI - res;
}

float IntegrateArc(float h1, float h2, float n) {
    float cosN = cos(n);
    float sinN = sin(n);
    return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN - cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}

vec3 GetCameraVec(vec2 uv) {
    return vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * aspect - aspect, 1.0);
}

#define SSAO_LIMIT Gtao.limit // 100
#define SSAO_SAMPLES Gtao.steps // 4
#define SSAO_RADIUS   Gtao.radius// 2.5
#define SSAO_FALLOFF  Gtao.fallOf // 1.5
#define SSAO_THICKNESSMIX  Gtao.thicknessMix // 0.2
#define SSAO_MAX_STRIDE Gtao.stride// 32
 
void SliceSample(vec2 tc_base, vec2 aoDir, int i, float targetMip, vec3 ray, vec3 v, inout float closest)
{
    vec2 uv = tc_base + aoDir * i;
    float depth = texture(gPosition, uv).a;
    // Vector from current pixel to current slice sample
    vec3 p = GetCameraVec(uv) * depth - ray;
    // Cosine of the horizon angle of the current sample
    float current = dot(v, normalize(p));
    // Linear falloff for samples that are too far away from current pixel

    //float falloff = clamp((Gtao.radius - length(p)) / Gtao.fallOf, 0.0, 1.0);
    float falloff = clamp((SSAO_RADIUS - length(p)) / SSAO_FALLOFF, 0.0, 1.0);

    if(current > closest)
        closest = mix(closest, current, falloff);
    // Helps avoid overdarkening from thin objects
    //closest = mix(closest, current, Gtao.thicknessMix * falloff);
    closest = mix(closest, current, SSAO_THICKNESSMIX * falloff);
}

void main(){
    float depthInfo = texture(gPosition, TexCoords).a;
    vec3 ray = GetCameraVec(TexCoords) * depthInfo;

    const float normalSampleDist = 1.0;

    vec2 uv = TexCoords + vec2(viewSizeDiv.x * normalSampleDist, 0.0);
    vec3 p1 = ray - GetCameraVec(uv) * depthInfo;

    uv = TexCoords + vec2(0.0, viewSizeDiv.y * normalSampleDist);
    vec3 p2 = ray - GetCameraVec(uv) * depthInfo;

    uv = TexCoords + vec2(-viewSizeDiv.x * normalSampleDist, 0.0);
    vec3 p3 = ray - GetCameraVec(uv) * depthInfo;
    
    uv = TexCoords + vec2(0.0, -viewSizeDiv.y * normalSampleDist);
    vec3 p4 = ray - GetCameraVec(uv) * depthInfo;

    vec3 normal1 = normalize(cross(p1, p2));
    vec3 normal2 = normalize(cross(p3, p4));
    
    vec3 normal = normalize(normal1 + normal2);

    //float stride = min((1.0 / length(ray)) * Gtao.limit, Gtao.stride);
    float stride = min((1.0 / length(ray)) * SSAO_LIMIT, SSAO_MAX_STRIDE);

    vec2 dirMult = viewSizeDiv.xy * stride;
    vec3 v = normalize(-ray);

    float dirAngle = (PI / 16.0) * (((int(gl_FragCoord.x) + int(gl_FragCoord.y) & 3) << 2) + (int(gl_FragCoord.x) & 3)) + angleOffset;
    //float dirAngle = (PI / 16.0) * (float(((int(gl_FragCoord.x) + int(gl_FragCoord.y)) & 3) << 2) + float(int(gl_FragCoord.x) & 3)) + angleOffset;
    vec2 aoDir = dirMult * vec2(sin(dirAngle), cos(dirAngle));

    vec3 toDir = GetCameraVec(TexCoords + aoDir);
    vec3 planeNormal = normalize(cross(v, -toDir));
    vec3 projectedNormal = normal - planeNormal * dot(normal, planeNormal);

    vec3 projectedDir = normalize(normalize(toDir) + v);
    float n = GTAOFastAcos(dot(-projectedDir, normalize(projectedNormal))) - PI_HALF;

    // Init variables
    float c1 = -1.0;
    float c2 = -1.0;
    
    vec2 tc_base = TexCoords + aoDir * (0.25 * ((int(gl_FragCoord.y) - int(gl_FragCoord.x)) & 3) - 0.375 + spacialOffset);

    const float minMip = 0.0;
    const float maxMip = 3.0;
    const float mipScale = 1.0 / 12.0;
    
    float targetMip = floor(clamp(pow(stride, 1.3) * mipScale, minMip, maxMip));

    //for(int i = -1; i >= -Gtao.steps; i--)
    for(int i = -1; i >= -SSAO_SAMPLES; i--)
    {
        SliceSample(tc_base, aoDir, i, targetMip, ray, v, c1);
    }
    //for(int i = 1; i <= Gtao.steps; i++)
    for(int i = 1; i <= SSAO_SAMPLES; i++)
    {
        SliceSample(tc_base, aoDir, i, targetMip, ray, v, c2);
    }
    
    // Finalize
    float h1a = -GTAOFastAcos(c1);
    float h2a = GTAOFastAcos(c2);
    
    // Clamp horizons to the normal hemisphere
    float h1 = n + max(h1a - n, -PI_HALF);
    float h2 = n + min(h2a - n, PI_HALF);
    
    float visibility = mix(1.0, IntegrateArc(h1, h2, n), length(projectedNormal));
    
    FragColor = visibility;
}