#version 460
out float FragColor;

in vec2 TexCoords;

uniform sampler2D image;
const float kernel[5] = float[] (0.0545, 0.2442, 0.4026, 0.2442, 0.0545);

void main() 
{
    vec2 texelSize = 1.0 / vec2(textureSize(image, 0));
    float result = 0.0;
    for (int i = -2; i <= 2; ++i) 
    {
        for (int j = -2; j <= 2; ++j) 
        {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            result += texture(image, TexCoords + offset).r * kernel[abs(i)] * kernel[abs(j)];
        }
    }
    FragColor = result;
}
