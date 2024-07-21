#version 460
out float FragColor;

in vec2 TexCoords;

uniform sampler2D image;

void main() 
{
    vec2 texelSize = 1.0 / vec2(textureSize(image, 0));
    float result = 0.0;
    for (int i = -1; i <= 1; ++i) 
    {
        for (int j = -1; j <= 1; ++j) 
        {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            result += texture(image, TexCoords + offset).r;
        }
    }
    FragColor = result / 9.0; // 3x3 ºË´°¿Ú£¬¹²9¸öÏñËØ
}
