#version 460
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gAlbedo;
uniform sampler2D gtao;

struct Light{
    vec3 Position;
    vec3 Color;
    
};

uniform Light light;

void main(){

    vec3 pos = texture(gPosition, TexCoords).rgb;
    vec3 nor = texture(gNormal, TexCoords).rgb;
    vec3 diffuse = texture(gAlbedo, TexCoords).rgb;
    float AmbientOcclusion = texture(gtao, TexCoords).r;
   
    //vec3 basic = vec3(Light.lightAttenuation * diffuse * AmbientOcclusion);
    vec3 basic = vec3(0.3 * diffuse * AmbientOcclusion);
    vec3 viewDir = normalize(-pos);

    //diffuse
    vec3 lightDir = normalize(light.Position - pos);
    vec3 diffuseColor = max(dot(nor, lightDir), 0.0) * diffuse * light.Color;

    //specular
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(nor, halfDir), 0.0), 8.0);
    vec3 specularColor = light.Color * spec;

    //float attenuation = light.attenuation;
    float attenuation =0.5;
    diffuseColor *= attenuation;
    specularColor *= attenuation;

    vec3 light = basic + diffuseColor + specularColor;
    
    
    //FragColor = vec4(texture(gAlbedo, TexCoords).rgb, 1.0);
    FragColor = vec4(light, 1.0);
    //FragColor = vec4(texture(gAlbedo, TexCoords).rgb, 1.0);
    //FragColor = vec4(vec3(AmbientOcclusion), 1.0);
}