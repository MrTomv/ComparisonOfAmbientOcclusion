#version 460
out float FragColor;

in vec2 TexCoords;

uniform sampler2D ao;

void main() 
{
    vec2 texelSize = 1.0 / vec2(textureSize(ao, 0));
    float result = 0.0;
    for (int i = -1; i <= 1; i++) 
    {
        for (int j = -1; j <= 1; j++) 
        {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            result += texture(ao, TexCoords + offset).r;
        }
    }
    FragColor = result / 9.0; 
}
