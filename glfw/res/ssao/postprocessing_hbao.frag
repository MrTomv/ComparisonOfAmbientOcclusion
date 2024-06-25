#version 460
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gAlbedo;
uniform sampler2D hbao;

void main(){
    
    float AmbientOcclusion = texture(hbao, TexCoords).r;
    //FragColor = vec4(texture(gAlbedo, TexCoords).rgb, 1.0);
    FragColor = vec4(vec3(AmbientOcclusion), 1.0);
}