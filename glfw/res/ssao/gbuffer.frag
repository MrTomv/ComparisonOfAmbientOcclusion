#version 460
layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec3 gNormal;
//layout (location = 2) out vec4 gAlbedoSpec;
layout (location = 2) out vec3 gAlbedo;

in vec2 TexCoords;
in vec3 FragPos;
in vec3 Normal;

uniform sampler2D texture_diffuse1;
uniform sampler2D texture_specular1;
// not test
uniform float uNear;
uniform float uFar;

const float u_Near = 0.1f;
const float u_Far = 10000.f;
float LinearizeDepth(float vDepth)
{
    float z = vDepth * 2.0 - 1.0; 
    return (2.0 * u_Near * u_Far) / (u_Far + u_Near - z * (u_Far - u_Near));    
}

void main()
{    
    // store the fragment position vector in the first gbuffer texture
    gPosition = vec4(FragPos, LinearizeDepth(gl_FragCoord.z));
    //gPosition = vec4(FragPos, gl_FragCoord.z);
    // also store the per-fragment normals into the gbuffer
    gNormal = normalize(Normal);

    //gAlbedo.rgb = vec3(0.95);
    gAlbedo.rgb = texture(texture_diffuse1, TexCoords).rgb;
    //gAlbedo.a = texture(texture_specular1, TexCoords).r;

    // and the diffuse per-fragment color
    //gAlbedoSpec.rgb = texture(texture_diffuse1, TexCoords).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    //gAlbedoSpec.a = texture(texture_specular1, TexCoords).r;

}