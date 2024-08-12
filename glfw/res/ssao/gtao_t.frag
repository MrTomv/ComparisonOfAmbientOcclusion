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
#define SSAO_LIMIT Gtao.limit 
#define SSAO_SAMPLES Gtao.steps 
#define SSAO_RADIUS   Gtao.radius
#define SSAO_FALLOFF  Gtao.fallOf
#define SSAO_THICKNESSMIX  Gtao.thicknessMix 
#define SSAO_MAX_STRIDE Gtao.stride

const vec2 viewSizeDiv = vec2(1.0 / Gtao.screenSize.x, 1.0 / Gtao.screenSize.y);
const float angleOffset = 0.1;
const float spacialOffset = 0.1;
const float normalSampleDist = 1.0;
const float minMip = 0.0;
const float maxMip = 3.0;
const float mipScale = 1.0 / 12.0;

// Fast inverse cosine function
float GTAOFastAcos(float x) {
    float res = -0.2 * abs(x) + PI_HALF;
    res *= sqrt(1.0 - abs(x));
    return x >= 0 ? res : PI - res;
}

// Integrated radian function
float IntegrateArc(float h1, float h2, float n) {
    float cosN = cos(n);
    float sinN = sin(n);
    return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN - cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}

// Sampling Slice Function
void SliceSample(vec2 tc_base, vec2 aoDir, int i, float targetMip, vec3 ray, vec3 v, inout float closest)
{
    vec2 uv = tc_base + aoDir * i;
    vec3 camv = vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * aspect - aspect, 1.0);
    float depth = texture(gPosition, uv).a;
    vec3 p = camv * depth - ray;
    float current = dot(v, normalize(p));

    float falloff = clamp((SSAO_RADIUS - length(p)) / SSAO_FALLOFF, 0.0, 1.0);

    if(current > closest)
        closest = mix(closest, current, falloff);
    closest = mix(closest, current, SSAO_THICKNESSMIX * falloff);
}

void main(){
    // Get depth information
    float depthInfo = texture(gPosition, TexCoords).a;
    vec3 texc = vec3(TexCoords.x * -2.0 + 1.0, TexCoords.y * 2.0 * aspect - aspect, 1.0);
    vec3 ray = texc * depthInfo;

    // Calculate Normals
    vec2 uv = TexCoords + vec2(viewSizeDiv.x * normalSampleDist, 0.0);
    vec3 p1 = ray - vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * aspect - aspect, 1.0) * depthInfo;

    uv = TexCoords + vec2(0.0, viewSizeDiv.y * normalSampleDist);
    vec3 p2 = ray - vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * aspect - aspect, 1.0) * depthInfo;

    uv = TexCoords + vec2(-viewSizeDiv.x * normalSampleDist, 0.0);
    vec3 p3 = ray - vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * aspect - aspect, 1.0) * depthInfo;
    
    uv = TexCoords + vec2(0.0, -viewSizeDiv.y * normalSampleDist);
    vec3 p4 = ray - vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * aspect - aspect, 1.0) * depthInfo;

    vec3 normal1 = normalize(cross(p1, p2));
    vec3 normal2 = normalize(cross(p3, p4));
    vec3 normal = normalize(normal1 + normal2);

    // Calculation step length
    float stride = min((1.0 / length(ray)) * SSAO_LIMIT, SSAO_MAX_STRIDE);

    vec2 dirMult = viewSizeDiv.xy * stride;
    vec3 v = normalize(-ray);

    // Calculate direction angle
    float dirAngle = (PI / 16.0) * (((int(gl_FragCoord.x) + int(gl_FragCoord.y) & 3) << 2) + (int(gl_FragCoord.x) & 3)) + angleOffset;
    vec2 aoDir = dirMult * vec2(sin(dirAngle), cos(dirAngle));
    vec2 texAo = TexCoords + aoDir;
    vec3 toDir = vec3(texAo.x * -2.0 + 1.0, texAo.y * 2.0 * aspect - aspect, 1.0);
    vec3 planeNormal = normalize(cross(v, -toDir));
    vec3 projectedNormal = normal - planeNormal * dot(normal, planeNormal);

    vec3 projectedDir = normalize(normalize(toDir) + v);
    float n = GTAOFastAcos(dot(-projectedDir, normalize(projectedNormal))) - PI_HALF;

    // Initialize the closest distance
    float c1 = -1.0;
    float c2 = -1.0;
    vec2 tc_base = TexCoords + aoDir * (0.25 * ((int(gl_FragCoord.y) - int(gl_FragCoord.x)) & 3) - 0.375 + spacialOffset);

    // Calculate the target mip level
    float targetMip = floor(clamp(pow(stride, 1.5) * mipScale, minMip, maxMip));

    // Sampling negative direction
    for(int i = -1; i >= -SSAO_SAMPLES; i--)
    {
        SliceSample(tc_base, aoDir, i, targetMip, ray, v, c1);
    }

    // Sampling positive direction
    for(int i = 1; i <= SSAO_SAMPLES; i++)
    {
        SliceSample(tc_base, aoDir, i, targetMip, ray, v, c2);
    }
    
    // Finalize
    float h1a = -GTAOFastAcos(c1);
    float h2a = GTAOFastAcos(c2);
    
    float h1 = n + max(h1a - n, -PI_HALF);
    float h2 = n + min(h2a - n, PI_HALF);
    
    float visibility = mix(1.0, IntegrateArc(h1, h2, n), length(projectedNormal));
    
    FragColor = visibility;
}