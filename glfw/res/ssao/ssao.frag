#version 460
out float FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D texNoise;
uniform vec3 samples[64];

int kernelSize = 64;
float radius = 0.75;
float bias = 0.035;
vec2 screenSize;

uniform mat4 projection;

mat3 calTBN(sampler2D normal, sampler2D texN, vec2 TexCoords, vec2 noiseScale){

    vec3 nor = normalize(texture(normal, TexCoords).rgb);
    vec3 rdv = normalize(texture(texN, TexCoords * noiseScale).xyz);
    vec3 tang = normalize(rdv - nor * dot(rdv, nor));
    vec3 bitg = cross(nor, tang);
    mat3 TBN = mat3(tang, bitg, nor);
    return TBN;
}


void main()
{
    float occlusion = 0.0;
    vec2 noiseScale = vec2(1280.0/4.0, 720.0/4.0); 
    vec3 pos = texture(gPosition, TexCoords).xyz;
    mat3 TBN = calTBN(gNormal, texNoise, TexCoords, noiseScale);
    for(int i = 0; i < kernelSize; ++i)
    {
        vec3 samPos = TBN * samples[i]; 
        samPos = pos + samPos * radius; 
        vec4 offset = vec4(samPos, 1.0);
        offset = projection * offset; 
        offset.xyz /= offset.w; 
        offset.xyz = offset.xyz * 0.5 + 0.5; 
        float sd = texture(gPosition, offset.xy).z; 

        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(pos.z - sd));
        occlusion += (sd >= samPos.z + bias ? 1.0 : 0.0) * rangeCheck;           
    }
    occlusion = 1.0 - (occlusion / kernelSize);
    
    FragColor = occlusion;
}
