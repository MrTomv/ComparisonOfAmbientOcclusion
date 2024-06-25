
#include <iostream>
#include <assimp/version.h>
#include <assimp/Importer.hpp>
#include <assimp/postprocess.h>
int main()
{
    Assimp::Importer importer;
    const char* filePath = "res/texture/sponza/Sponza.gltf";
    //const char* filePath = "res/texture/sponza_simple/sponza.gltf";
    //const char* filePath = R"(C:\Users\10373\Desktop\github demo\OpenGL - master\glfw\res\texture\sponza\Sponza.gltf)";
    
    const aiScene* scene = importer.ReadFile(filePath, aiProcess_Triangulate);

    if (!scene)
    {
        std::cerr << "ERROR::ASSIMP:: " << importer.GetErrorString() << std::endl;
        std::cerr << "Failed to load file: " << filePath << std::endl;
        return -1;
    }

    std::cout << "Successfully loaded glTF file: " << filePath << std::endl;

    // 获取Assimp版本信息
    //unsigned int majorVersion = aiGetVersionMajor();
    //unsigned int minorVersion = aiGetVersionMinor();
    //unsigned int revisionVersion = aiGetVersionRevision();

    //std::cout << "Assimp version: "
    //    << majorVersion << "."
    //    << minorVersion << "."
    //    << revisionVersion << std::endl;
    //return 0;
}
