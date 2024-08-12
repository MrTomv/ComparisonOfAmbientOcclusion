#define STB_IMAGE_IMPLEMENTATION

#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <shader_s.h>
#include <iostream>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <Camera.h>
#include <Model.h>
#include <random>
#include <imgui/imgui.h>
#include <imgui/imgui_impl_glfw.h>
#include <imgui/imgui_impl_opengl3.h>
#include <tracy/public/tracy/Tracy.hpp>

const float PI = 3.14159265;

// shader path
#define SHADERDIR_ "res/ssao/"
    constexpr char const* gBufferVertPath = SHADERDIR_ "gbuffer.vert";
    constexpr char const* gBufferFragPath = SHADERDIR_ "gbuffer.frag";
    constexpr char const* postprocessingVertPath = SHADERDIR_ "postprocessing.vert";
    constexpr char const* postprocessingFragPath = SHADERDIR_ "postprocessing.frag";
    constexpr char const* lightBoxVertPath = SHADERDIR_ "ssao.vert";

    // ssao
    constexpr char const* postprocessingSSAOFragPath = SHADERDIR_ "postprocessing_ssao.frag";
    constexpr char const* ssaoOnlyFragPath = SHADERDIR_ "ao/ssao_only.frag";
    constexpr char const* lightBoxFragPath = SHADERDIR_ "ssao.frag";
    // hbao
    constexpr char const* postprocessingHbaoFragPath = SHADERDIR_ "postprocessing_hbao.frag";
    constexpr char const* hbaoOnlyFragPath = SHADERDIR_ "ao/hbao_only.frag";
    constexpr char const* HbaoFragPath = SHADERDIR_ "hbao_t.frag";
    // gtao
    constexpr char const* postprocessingGtaoFragPath = SHADERDIR_ "postprocessing_gtao.frag";
    constexpr char const* gtaoOnlyFragPath = SHADERDIR_ "ao/gtao_only.frag";
    constexpr char const* GtaoFragPath = SHADERDIR_ "gtao_t.frag";

    // blur algorithm
    #define BLURDIR_ "res/ssao/blur/"
    constexpr char const* blurVertPath = SHADERDIR_ "ssao.vert";
    constexpr char const* meanBlurFragPath = BLURDIR_ "meanBlur.frag";
    constexpr char const* boxBlurFragPath = BLURDIR_ "boxBlur.frag";
    constexpr char const* gaussianBlurFragPath = BLURDIR_ "gaussianBlur.frag";

#define MODELDIR_ "res/texture/"
    //constexpr char const* modelPath = MODELDIR_ "sponza/sponza.obj";
    //constexpr char const* modelPath = MODELDIR_ "crytek-sponza/sponza.obj";
    //constexpr char const* modelPath = MODELDIR_ "sponza_complex/sponza_with_ship.obj";
    
    constexpr char const* modelPath = MODELDIR_ "sponza/Sponza.gltf";
    constexpr char const* CarModelPath = MODELDIR_  "Dragon/DragonAttenuation.gltf"; 
    constexpr char const* nanosuitModelPath = MODELDIR_ "nanosuit/nanosuit.obj";


void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
void processInput(GLFWwindow* window);
unsigned int loadTexture(const char* path);
float ourLerp(float a, float b, float f);
void renderQuad();
void renderSSAO(GLuint ssaoFBO, Shader& lightBox, const std::vector<glm::vec3>& ssaoKernel, GLuint gPosition, GLuint gNormal, GLuint noiseTexture, const glm::mat4& projection);
void renderHBAO(GLuint ssaoFBO, Shader& hbao, GLuint gPosition, GLuint gNormal, GLuint noiseTexture);
void renderGTAO(GLuint ssaoFBO, Shader& gtao, GLuint gPosition, GLuint gNormal, GLuint noiseTexture, ImVec4 intPara, ImVec4 floatPara);
void renderAOGreyScaleOnly(GLuint ssaoFBO, Shader& onlyGSSHADER);
void renderBlur(GLuint ssaoFBO, Shader& meanBlur, GLuint meanBlurColorBuffer);
void printFrame(ImGuiIO& io, std::vector<float>& t);
void printDelta(ImGuiIO& io, std::vector<float>& t);

void testDelta(bool& test, ImGuiIO& io, std::vector<float>& frame, bool& show, const char* aoEffectName[4], int aoEffectChoice, const char* blurEffectName[4], int blurEffectChoice, bool isLight, const char* gsEffectName[4], int gsEffectChoice, string);

void postprocessingForHBAO(Shader& postProcessingHbao, glm::vec3& lightPos, glm::vec3& lightColor);

void testFrameRate(bool& test, ImGuiIO& io, std::vector<float>& frame, bool& show, const char* aoEffectName[4], int aoEffectChoice, const char* blurEffectName[4], int blurEffectChoice, bool isLight, const char* gsEffectName[4], int gsEffectChoice, string filename);

void postprocessingForGTAO(Shader& postProcessingGtao, glm::vec3& lightPos, glm::vec3& lightColor);

void postprocessingForSSAO(Shader& postProcessing, glm::vec3& lightPos, glm::vec3& lightColor);

void frameDataIntoCSV(const std::vector<float>& frame, const std::string& filename);

// settings
const unsigned int SCR_WIDTH = 1920;
const unsigned int SCR_HEIGHT = 1080;
bool blinn = false;
bool blinnKeyPressed = false;
// camera
Camera camera(glm::vec3(-760.0f, 145.0f, -30.0f));

float lastX = (float)SCR_WIDTH / 2.0;
float lastY = (float)SCR_HEIGHT / 2.0;
bool firstMouse = true;

// timing
float deltaTime = 0.0f;
float lastFrame = 0.0f;

//mouse
bool cursorEnabled = false;
bool rightMouseButtonPressed = false;
bool leftShift = false;

float ourLerp(float a, float b, float f)
{
    return a + f * (b - a);
}

// lighting
//glm::vec3 lightPos(1.2f, 1.0f, 2.0f);

enum AOstate {
    NONE,
    SSAO,
    HBAO,
    GTAO,
};

enum BlurState {
    None,
    MeanBlur
};

enum AOGreyScale {
    none,
    ssao,
    hbao,
    gtao
};

int main()
{
    TracyMessageL("Tracy client initialized");
    // glfw: initialize and configure
    // ------------------------------
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    //glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
    // glfw window creation
    // --------------------
    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "MSc", NULL, NULL);
    if (window == NULL)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);
    glfwSetScrollCallback(window, scroll_callback);

    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    // tell GLFW to capture our mouse
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    // glad: load all OpenGL function pointers
    // ---------------------------------------
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    //imgui initial
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO(); (void)io;
    ImGui::StyleColorsDark();
    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 460");
    AOstate aoEffectChoice = NONE;
    const char* aoEffectName[] = { "NONE", "SSAO", "HBAO", "GTAO" };

    BlurState blurEffectChoice = None;
    const char* blurEffectName[] = { "None", "Meam Blur", "Box Blur"};

    AOGreyScale gsEffectChoice = none;
    const char* gsEffectName[] = { "none", "ssao", "hbao", "gtao" };

    // End

    ImVec4 clear_color = ImVec4(0.45f, 0.55f, 0.60f, 1.00f);
    // configure global opengl state
    // -----------------------------
    stbi_set_flip_vertically_on_load(true);
    glEnable(GL_DEPTH_TEST);
    //glEnable(GL_BLEND);
    //glEnable(GL_FRAMEBUFFER_SRGB);
    //glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    // build and compile our shader zprogram
    // ------------------------------------

    // load shader
    // normal
    Shader gBufferShader(gBufferVertPath, gBufferFragPath);
    //Shader postProcessing(postprocessingVertPath, postprocessingFragPath);
    // SSAO
    Shader postProcessing(postprocessingVertPath, postprocessingSSAOFragPath);
    Shader lightBox(lightBoxVertPath, lightBoxFragPath);

    // HBAO
    Shader postProcessingHbao(postprocessingVertPath, postprocessingHbaoFragPath);
    Shader hbao(lightBoxVertPath, HbaoFragPath);

    //GTAO
    Shader postProcessingGtao(postprocessingVertPath, postprocessingGtaoFragPath);
    Shader gtao(lightBoxVertPath, GtaoFragPath);
    
    // Blur
    // mean blur algorithm
    Shader meanBlur(blurVertPath, meanBlurFragPath);
    Shader boxBlur(blurVertPath, boxBlurFragPath);
    Shader gauessianBlur(blurVertPath, gaussianBlurFragPath);
    // load obj
    Model sponza(modelPath);
    Model nanosuit(nanosuitModelPath);
    Model toyCar(CarModelPath);

    //Just rendering ao greyScale
    Shader onlySSAO(lightBoxVertPath, ssaoOnlyFragPath);
    Shader onlyHBAO(lightBoxVertPath, hbaoOnlyFragPath);
    Shader onlyGTAO(lightBoxVertPath, gtaoOnlyFragPath);

    // configure g-buffer framebuffer
    // ------------------------------
    unsigned int gBuffer;
    glGenFramebuffers(1, &gBuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
    unsigned int gPosition, gNormal, gAlbedo;
    // position color buffer
    glGenTextures(1, &gPosition);
    glBindTexture(GL_TEXTURE_2D, gPosition);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gPosition, 0);
    // normal color buffer
    glGenTextures(1, &gNormal);
    glBindTexture(GL_TEXTURE_2D, gNormal);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, gNormal, 0);
    // color + specular color buffer
    glGenTextures(1, &gAlbedo);
    glBindTexture(GL_TEXTURE_2D, gAlbedo);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT2, GL_TEXTURE_2D, gAlbedo, 0);
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering 
    unsigned int attachments[3] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2 };
    glDrawBuffers(3, attachments);
    // create and attach depth buffer (renderbuffer)
    unsigned int rboDepth;
    glGenRenderbuffers(1, &rboDepth);
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    // finally check if framebuffer is complete
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // also create framebuffer to hold SSAO processing stage 
    // -----------------------------------------------------
    unsigned int ssaoFBO, ssaoBlurFBO;
    glGenFramebuffers(1, &ssaoFBO);  
    glGenFramebuffers(1, &ssaoBlurFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    unsigned int ssaoColorBuffer, ssaoColorBufferBlur;
    // SSAO color buffer
    glGenTextures(1, &ssaoColorBuffer);
    glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, SCR_WIDTH, SCR_HEIGHT, 0, GL_RED, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoColorBuffer, 0);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "SSAO Framebuffer not complete!" << std::endl;
    // and blur stage
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoBlurFBO);
    glGenTextures(1, &ssaoColorBufferBlur);
    glBindTexture(GL_TEXTURE_2D, ssaoColorBufferBlur);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, SCR_WIDTH, SCR_HEIGHT, 0, GL_RED, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoColorBufferBlur, 0);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "SSAO Blur Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // generate sample kernel
    // ----------------------
    std::uniform_real_distribution<GLfloat> randomFloats(0.0, 1.0); // generates random floats between 0.0 and 1.0
    std::default_random_engine generator;
    std::vector<glm::vec3> ssaoKernel;
    for (unsigned int i = 0; i < 64; ++i)
    {
        glm::vec3 sample(randomFloats(generator) * 2.0 - 1.0, randomFloats(generator) * 2.0 - 1.0, randomFloats(generator));
        sample = glm::normalize(sample);
        sample *= randomFloats(generator);
        float scale = float(i) / 64.0f;

        // scale samples s.t. they're more aligned to center of kernel
        scale = ourLerp(0.1f, 1.0f, scale * scale);
        sample *= scale;
        ssaoKernel.push_back(sample);
    }

    // generate noise texture for ssao
    // ----------------------
    std::vector<glm::vec3> ssaoNoise;
    for (unsigned int i = 0; i < 16; i++)
    {
        glm::vec3 noise(randomFloats(generator) * 2.0 - 1.0, randomFloats(generator) * 2.0 - 1.0, 0.0f); // rotate around z-axis (in tangent space)
        ssaoNoise.push_back(noise);
    }

    // generate noise texture for gtao
    // ----------------------
    std::vector<float> gtaoNoise;
    for (unsigned int i = 0; i < 16; i++) {
        float noise = randomFloats(generator) * 2.0 - 1.0;
        gtaoNoise.push_back(noise);
    }
    unsigned int noiseTexture, gtaoTexture; 
    glGenTextures(1, &noiseTexture);
    glBindTexture(GL_TEXTURE_2D, noiseTexture);
    //SSAO and HBAO
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 4, 4, 0, GL_RGB, GL_FLOAT, &ssaoNoise[0]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    // GTAO
    glGenTextures(1, &gtaoTexture);
    glBindTexture(GL_TEXTURE_2D, gtaoTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 4, 4, 0, GL_RGB, GL_FLOAT, &gtaoNoise[0]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

    // ImGui Editor 
    ImVec4 normal_color = ImVec4(1.f, 1.f, 1.f, 1.00f);
    ImVec4 normal_pos = ImVec4(0.0, 2000.0f, 0.0f, 1.0f);
    //Int 
    ImVec4 intPara = ImVec4(165.f, 1000.f, 9.f, 1);
    ImVec4 floatPara = ImVec4(12.5f, 1.5f, 0.2f, 1);

    // lighting info
    
    // -------------
    //const unsigned int NR_LIGHTS = 32;
    //std::vector<glm::vec3> lightPositions;
    //std::vector<glm::vec3> lightColors;
    //srand(13);
    //for (unsigned int i = 0; i < NR_LIGHTS; i++)
    //{
    //    // calculate slightly random offsets
    //    float xPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
    //    float yPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 4.0);
    //    float zPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
    //    lightPositions.push_back(glm::vec3(xPos, yPos, zPos));
    //    // also calculate random color
    //    float rColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
    //    float gColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
    //    float bColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
    //    lightColors.push_back(glm::vec3(rColor, gColor, bColor));
    //}
    //glm::vec3 lightColor = glm::vec3(0.2, 0.2, 0.7);
    //glm::vec3 lightColor = glm::vec3(normal_color.x, normal_color.y, normal_color.z);
    // shader configuration
    // --------------------
    postProcessing.use();
    postProcessing.setInt("gPosition", 0);
    postProcessing.setInt("gNormal", 1);
    postProcessing.setInt("gAlbedo", 2);
    postProcessing.setInt("ssao", 3);

    lightBox.use();
    lightBox.setInt("gPosition", 0);
    lightBox.setInt("gNormal", 1);
    lightBox.setInt("texNoise", 2);

    // HBAO
    postProcessingHbao.use();
    postProcessingHbao.setInt("gPosition", 0);
    postProcessingHbao.setInt("gNormal", 1);
    postProcessingHbao.setInt("gAlbedo", 2);
    postProcessingHbao.setInt("hbao", 3);

    hbao.use();
    hbao.setInt("gPosition", 0);
    hbao.setInt("gNormal", 1);
    hbao.setInt("texNoise", 2);
    //GTAO
    postProcessingGtao.use();
    postProcessingGtao.setInt("gPosition", 0);
    postProcessingGtao.setInt("gNormal", 1);
    postProcessingGtao.setInt("gAlbedo", 2);
    postProcessingGtao.setInt("gtao", 3);

    gtao.use();
    gtao.setInt("gPostion", 0);
    gtao.setInt("gNormal", 1);
    gtao.setInt("gAlbedo", 2);
    gtao.setInt("gtaoNoise", 3);
    
    // only ao greyScale
    onlySSAO.use();
    onlySSAO.setInt("gPosition", 0);
    onlySSAO.setInt("gNormal", 1);
    onlySSAO.setInt("gAlbedo", 2);
    onlySSAO.setInt("ssao", 3);

    onlyHBAO.use();
    onlyHBAO.setInt("gPosition", 0);
    onlyHBAO.setInt("gNormal", 1);
    onlyHBAO.setInt("gAlbedo", 2);
    onlyHBAO.setInt("hbao", 3);

    onlyGTAO.use();
    onlyGTAO.setInt("gPosition", 0);
    onlyGTAO.setInt("gNormal", 1);
    onlyGTAO.setInt("gAlbedo", 2);
    onlyGTAO.setInt("gtao", 3);

    
    // Blur Algorithm

    bool test = false;
    bool show = false;
    bool isLight = false;
    bool enableNano = false;
    bool enableCar = false;
    std::vector<float> frame;
    float circleTime = glfwGetTime();
    // render loop
    // -----------
    while (!glfwWindowShouldClose(window))
    {
        ZoneScoped;
        glm::vec3 lightPos = glm::vec3(normal_pos.x, normal_pos.y, normal_pos.z);
        glm::vec3 lightColor = glm::vec3(normal_color.x, normal_color.y, normal_color.z);
        // per-frame time logic
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        // input
        // -----
        processInput(window);
        glfwPollEvents();
        // render imgui
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();
        {
        // simple window
        ImGui::Begin("Control Panel");
        ImGui::Indent(); 

        ImGui::Text("Light Position");
        ImGui::DragFloat3("Reset Light Position", (float*)&normal_pos);

        ImGui::Text("Light Color");
        ImGui::ColorEdit3("Reset Light Color", (float*)&normal_color);
        ImGui::Indent(); 
        ImGui::DragFloat3("RInt", (float*)&intPara);
        ImGui::DragFloat3("RFloat", (float*)&floatPara);
        ImGui::Indent(); 
        ImGui::Checkbox("Using Light", &isLight);

        if (isLight) {
            //std::cout << "Light On." << std::endl;
            if (gsEffectChoice != none) {
                gsEffectChoice = none;  
            }
            ImGui::Text("AO Effect with light");
            int currentEffect = static_cast<int>(aoEffectChoice);
            if(ImGui::Combo("AO Effect with light", &currentEffect, aoEffectName, IM_ARRAYSIZE(aoEffectName))) {
                aoEffectChoice = static_cast<AOstate>(currentEffect);
                std::cout << "Now AO Effect is: " << aoEffectName[aoEffectChoice] << std::endl;
            }
        }
        else {
            if (aoEffectChoice != NONE) {
                aoEffectChoice = NONE;  
            }
            ImGui::Text("AO GreyScale");
            int currentGSEffect = static_cast<int>(gsEffectChoice);
            if(ImGui::Combo("AO GreyScale", &currentGSEffect, gsEffectName, IM_ARRAYSIZE(gsEffectName))) {
                gsEffectChoice = static_cast<AOGreyScale>(currentGSEffect);
                string t = gsEffectName[gsEffectChoice];
                std::cout << "Now AO GreyScale Effect is: " << t.c_str() << std::endl;
            }

        }
        ImGui::Text("Blur Effect");
        int currentBlurEffect = static_cast<int>(blurEffectChoice);
        if(ImGui::Combo("Blur Effect", &currentBlurEffect, blurEffectName, IM_ARRAYSIZE(blurEffectName))) {
            blurEffectChoice = static_cast<BlurState>(currentBlurEffect);
            std::cout << "Now Blur Effect is: " << blurEffectName[blurEffectChoice] << std::endl;
        }

        ImGui::Text("Application average %.3f ms/frame (%.1f FPS)", 1000.0f / io.Framerate, io.Framerate);
        ImGui::Text("Application delta time %.3fms", io.DeltaTime*1000.0f);
        if (ImGui::Button("Performance", ImVec2(100, 50)))
        {
            test = test ? false : true;
            if (test == false)
                show = true;
            else
                show = false;
            std::cout << "Test Start! Test status: "<< test <<". Show status: " << show << std::endl;
            std::cout << "-------------------------------------------------------" << std::endl;
        }

        ImGui::Indent();
        ImGui::Text("Add More Model");
        ImGui::Checkbox("Nanosuit", &enableNano);
        ImGui::Checkbox("Car", &enableCar);


        ImGui::End();

        ImGui::Render();
        int display_w, display_h;
        glfwGetFramebufferSize(window, &display_w, &display_h);
        glViewport(0, 0, display_w, display_h);
        glClearColor(clear_color.x * clear_color.w, clear_color.y * clear_color.w, clear_color.z * clear_color.w, clear_color.w);
        glClear(GL_COLOR_BUFFER_BIT);
        // END
        //glfwMakeContextCurrent(window);
        //glfwSwapBuffers(window);
        }
        // render
        // ------
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // -----------------------------------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 10000.0f);
        glm::mat4 view = camera.GetViewMatrix();
        glm::mat4 model = glm::mat4(1.0f);
        gBufferShader.use();
        gBufferShader.setMat4("projection", projection);
        gBufferShader.setMat4("view", view);
        gBufferShader.setFloat("uNear", 0.1f);
        gBufferShader.setFloat("uFar", 10000.f);

        // sponza model on the floor
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.5f, 0.0));
        model = glm::rotate(model, glm::radians(0.0f), glm::vec3(1.0, 0.0, 0.0));
        model = glm::scale(model, glm::vec3(1.0f));
        gBufferShader.setMat4("model", model);
        sponza.Draw(gBufferShader);

        // render nanosuit model
        float currentTime = glfwGetTime();
        float deltaTime = currentTime - circleTime;
        float circle = sin(deltaTime) * 50.0f;
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.f , 0.0+ circle));
        model = glm::rotate(model, glm::radians(0.0f), glm::vec3(1.0, 0.0, 0.0));
        model = glm::rotate(model, glm::radians(-90.0f), glm::vec3(0.0, 1.0, 0.0));
        model = glm::scale(model, glm::vec3(15.0f));
        gBufferShader.setMat4("model", model);
        if(enableNano)
            nanosuit.Draw(gBufferShader);

        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-250.0f+circle, 0.f, 50.0));
        model = glm::rotate(model, glm::radians(90.0f), glm::vec3(1.0, 0.0, 0.0));
        model = glm::scale(model, glm::vec3(50.f));
        gBufferShader.setMat4("model", model);
        if(enableCar)
            toyCar.Draw(gBufferShader);

        glBindFramebuffer(GL_FRAMEBUFFER, 0);

 
        if (aoEffectChoice == 1 || gsEffectChoice == 1)
            renderSSAO(ssaoFBO, lightBox, ssaoKernel, gPosition, gNormal, noiseTexture, projection);

        if (aoEffectChoice == 2 || gsEffectChoice == 2)
            renderHBAO(ssaoFBO, hbao, gPosition, gNormal, noiseTexture);

        if (aoEffectChoice == 3 || gsEffectChoice == 3)
            renderGTAO(ssaoFBO, gtao, gPosition, gNormal, noiseTexture, intPara, floatPara);
        
        if (blurEffectChoice == 1)
            renderBlur(ssaoBlurFBO, meanBlur, ssaoColorBuffer);
        if (blurEffectChoice == 2)
            renderBlur(ssaoBlurFBO, boxBlur, ssaoColorBuffer);
        if (blurEffectChoice == 3)
            renderBlur(ssaoBlurFBO, gauessianBlur, ssaoColorBuffer);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        
        // -----------------------------------------------------------
        if (aoEffectChoice == 1 || gsEffectChoice == 1) {
            if(aoEffectChoice == 1)
                postprocessingForSSAO(postProcessing, lightPos, lightColor);
            if (gsEffectChoice == 1)
                onlySSAO.use();
        }

        if (aoEffectChoice == 2 || gsEffectChoice == 2) {
            if(aoEffectChoice == 2)
            // HBAO Setting for postprocessing_hbap fragment
                postprocessingForHBAO(postProcessingHbao, lightPos, lightColor);
            if (gsEffectChoice == 2)
                onlyHBAO.use();

        }

        if (aoEffectChoice == 3 || gsEffectChoice == 3) {
        // GTAO setting for postprocessing_gtao fragment
            if(aoEffectChoice == 3)
                postprocessingForGTAO(postProcessingGtao, lightPos, lightColor);
            if (gsEffectChoice == 3)
                onlyGTAO.use();
        }


        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gPosition);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, gNormal);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, gAlbedo);
        glActiveTexture(GL_TEXTURE3); 
        if(blurEffectChoice == 0)
            glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);
        else
            glBindTexture(GL_TEXTURE_2D, ssaoColorBufferBlur);
                
        renderQuad();
        //glBindFramebuffer(GL_FRAMEBUFFER, 0);
        //test
        testFrameRate(test, io, frame, show, aoEffectName, aoEffectChoice, blurEffectName, blurEffectChoice, isLight, gsEffectName, gsEffectChoice,"DeltaTime_");

        // -------------------------------------------------------------------------------
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(window);
        glfwPollEvents();
        FrameMark;
    }

    // glfw: terminate, clearing all previously allocated GLFW resources.
    // ------------------------------------------------------------------
    // clearing imgui
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwTerminate();

    return 0;
}

void postprocessingForSSAO(Shader& postProcessing, glm::vec3& lightPos, glm::vec3& lightColor)
{
    postProcessing.use();
    //send light relevant uniforms
    glm::vec3 lightPosView = glm::vec3(camera.GetViewMatrix() * glm::vec4(lightPos, 1.0));
    postProcessing.setVec3("light.Position", lightPosView);
    postProcessing.setVec3("light.Color", lightColor);
    // Update attenuation parameters
    const float linear = 0.00009f;
    const float quadratic = 0.000032f;
    postProcessing.setFloat("light.Linear", linear);
    postProcessing.setFloat("light.Quadratic", quadratic);
}

void postprocessingForGTAO(Shader& postProcessingGtao, glm::vec3& lightPos, glm::vec3& lightColor)
{
    postProcessingGtao.use();
    glm::vec3 lightPosView = glm::vec3(camera.GetViewMatrix() * glm::vec4(lightPos, 1.0));
    postProcessingGtao.setVec3("light.Position", lightPosView);
    postProcessingGtao.setVec3("light.Color", lightColor);
}

void postprocessingForHBAO(Shader& postProcessingHbao, glm::vec3& lightPos, glm::vec3& lightColor)
{
    postProcessingHbao.use();
    glm::vec3 lightPosView = glm::vec3(camera.GetViewMatrix() * glm::vec4(lightPos, 1.0));
    postProcessingHbao.setVec3("light.Position", lightPosView);
    postProcessingHbao.setVec3("light.Color", lightColor);
}

void testFrameRate(bool &test, ImGuiIO& io, std::vector<float>& frame, bool &show, const char* aoEffectName[4], int aoEffectChoice, const char* blurEffectName[4], int blurEffectChoice, bool isLight, const char*gsEffectName[4], int gsEffectChoice, string filename)
{

    if (test) {
        if (test == true) {
            printFrame(io, frame);
        }
    }
    if (!frame.empty() && show == true && test == false || frame.size() == 300) {
        if (frame.size() == 300) {
            test = false;
            show = true;
            std::cout << "Test Completed! Now Test status is: " << test << ". Show status is: " << show << std::endl;
        }
        float avg = 0.0, sum = 0.0;
        int i = 0;
        for (const auto& f : frame) {
            sum += f;
        }
        string type;
        if (!isLight) {
            type = gsEffectName[gsEffectChoice];
            type = type.c_str();
        }
        else {
            type = aoEffectName[aoEffectChoice];
            type = type.c_str();
        }
        std::cout << "Test Info - recording ao type: " << type
            << "  recording blur type: " << blurEffectName[blurEffectChoice]
            << "  Average frame is:  " << sum / frame.size() << "  recording frame count: " << frame.size() << std::endl;
        string ao = aoEffectName[aoEffectChoice];
        string blur = blurEffectName[blurEffectChoice];

        string filenameType;
        if (!isLight) {
            filenameType = "greyScale";
            filenameType = filenameType.c_str();
        }
        else {
            filenameType = "light";
            filenameType = filenameType.c_str();
        }
        frameDataIntoCSV(frame, "data/test/720/"+ filename + type + "_" + blur + "_"+ filenameType + ".csv");
        std::cout << "------------------ Completed -------------------------" << std::endl;
        frame.clear();

    }
}

void renderSSAO(GLuint ssaoFBO, Shader& lightBox, const std::vector<glm::vec3>& ssaoKernel, GLuint gPosition, GLuint gNormal, GLuint noiseTexture, const glm::mat4& projection){
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    glClear(GL_COLOR_BUFFER_BIT);
    lightBox.use();
    // Send kernel + rotation 
    for (unsigned int i = 0; i < 64; ++i)
        lightBox.setVec3("samples[" + std::to_string(i) + "]", ssaoKernel[i]);
    lightBox.setMat4("projection", projection);
    lightBox.setVec2("screenSize", glm::vec2(SCR_WIDTH, SCR_HEIGHT));
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, gPosition);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, gNormal);
    glActiveTexture(GL_TEXTURE2);
    glBindTexture(GL_TEXTURE_2D, noiseTexture);

    renderQuad();
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void renderHBAO(GLuint ssaoFBO, Shader& hbao, GLuint gPosition, GLuint gNormal, GLuint noiseTexture) {
    // generate HBAO texture
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    glClear(GL_COLOR_BUFFER_BIT);
    hbao.use();
    hbao.setVec2("hbao.screenSize", glm::vec2(SCR_WIDTH,SCR_HEIGHT ));
    hbao.setFloat("hbao.radius", 1.f);
    hbao.setFloat("hbao.maxRadiusPixels", 500.0f);
    hbao.setFloat("hbao.bias", 0.01f);
    hbao.setInt("hbao.directions", 64);
    hbao.setInt("hbao.steps", 8);
    hbao.setFloat("hbao.near", 0.1f);
    hbao.setFloat("hbao.far", 10000.f);
    hbao.setFloat("hbao.fov", glm::radians(60.0f));
    hbao.setFloat("hbao.aoStrength", 1.0f);
    hbao.setVec2("hbao.focalLen", glm::vec2(1.0f / tan(glm::radians(60.0f) / 2.0f)));
    hbao.setFloat("hbao.con1", 300);
    hbao.setFloat("hbao.con2", 300 * 300);
    hbao.setFloat("hbao.con3", -1.0/(300*300));
    hbao.setFloat("hbao.con4", tan(30.0 * PI /180.0));

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, gPosition);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, gNormal);
    glActiveTexture(GL_TEXTURE2);
    glBindTexture(GL_TEXTURE_2D, noiseTexture);
    renderQuad();
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void renderGTAO(GLuint ssaoFBO, Shader& gtao, GLuint gPosition, GLuint gNormal, GLuint noiseTexture, ImVec4 intPara, ImVec4 floatPara) {
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    glClear(GL_COLOR_BUFFER_BIT);
    gtao.use();
    gtao.setVec2("Gtao.screenSize", glm::vec2(SCR_WIDTH, SCR_HEIGHT));
    gtao.setInt("Gtao.steps", intPara.x);
    gtao.setFloat("Gtao.limit", intPara.y);
    gtao.setFloat("Gtao.stride", intPara.z);
    gtao.setFloat("Gtao.radius", floatPara.x);
    gtao.setFloat("Gtao.fallOf", floatPara.y);
    gtao.setFloat("Gtao.thicknessMix", floatPara.z);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, gPosition);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, gNormal);
    glActiveTexture(GL_TEXTURE2);
    glBindTexture(GL_TEXTURE_2D, noiseTexture);
    renderQuad();
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}


void renderAOGreyScaleOnly(GLuint ssaoFBO, Shader& onlyGSSHADER) {
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    glClear(GL_COLOR_BUFFER_BIT);
    onlyGSSHADER.use();

    renderQuad();
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void renderBlur(GLuint ssaoFBO, Shader& blurShader, GLuint blurColorBuffer) {
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    glClear(GL_COLOR_BUFFER_BIT);
    blurShader.use();
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, blurColorBuffer);
    renderQuad();
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

unsigned int quadVAO = 0;
unsigned int quadVBO;
void renderQuad()
{
    if (quadVAO == 0)
    {
        float quadVertices[] = {
            // positions        // texture Coords
            -1.0f,  1.0f, 0.0f, 0.0f, 1.0f,
            -1.0f, -1.0f, 0.0f, 0.0f, 0.0f,
             1.0f,  1.0f, 0.0f, 1.0f, 1.0f,
             1.0f, -1.0f, 0.0f, 1.0f, 0.0f,
        };
        // setup plane VAO
        glGenVertexArrays(1, &quadVAO);
        glGenBuffers(1, &quadVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    }
    glBindVertexArray(quadVAO);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glBindVertexArray(0);
}


// process all input: query GLFW whether relevant keys are pressed/released this frame and react accordingly
// ---------------------------------------------------------------------------------------------------------
void processInput(GLFWwindow* window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_B) == GLFW_PRESS && !blinnKeyPressed)
    {
        blinn = !blinn;
        blinnKeyPressed = true;
    }
    if (glfwGetKey(window, GLFW_KEY_B) == GLFW_RELEASE)
    {
        blinnKeyPressed = false;
    }
    if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT) == GLFW_PRESS && !rightMouseButtonPressed)
    {
        cursorEnabled = !cursorEnabled;
        rightMouseButtonPressed = true;
        if (cursorEnabled)
        {
            glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_NORMAL);
        }
        else
        {
            glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
            firstMouse = true; // Reset mouse tracking when re-enabling camera movement
        }
    }
    if (glfwGetKey(window, GLFW_KEY_LEFT_SHIFT) == GLFW_PRESS) {
        camera.SetCameraSpeedRate(2.f);
        
    }
    else 
    {
        camera.SetCameraSpeedRate(0.5f);
    }
    if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT) == GLFW_RELEASE)
    {
        rightMouseButtonPressed = false;
    }
    if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS)
        camera.ProcessKeyboard(ROTATE_LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS)
        camera.ProcessKeyboard(ROTATE_RIGHT, deltaTime);
}

// glfw: whenever the window size changed (by OS or user resize) this callback function executes
// ---------------------------------------------------------------------------------------------
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and 
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}


// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    if (cursorEnabled) return;

    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top

    lastX = xpos;
    lastY = ypos;

    camera.ProcessMouseMovement(xoffset, yoffset);
}

// 
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}
unsigned int loadTexture(const char* path)
{
    unsigned int textureid;
    glGenTextures(1, &textureid);
    int width, height, nrcomponent;
    unsigned char* data = stbi_load(path, &width, &height, &nrcomponent, 0);
    if (data)
    {
        GLenum format;
        if (nrcomponent == 1)
            format = GL_RED;
        else if (nrcomponent == 3)
            format = GL_RGB;
        else if (nrcomponent == 4)
            format = GL_RGBA;
        glBindTexture(GL_TEXTURE_2D, textureid);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }
    return textureid;
}

void printFrame(ImGuiIO &io, std::vector<float> &t) {
    t.push_back(io.DeltaTime*1000.f);
}

void frameDataIntoCSV(const std::vector<float>& frame, const std::string& filename) {
    std::ofstream csv(filename);

    if (!csv.is_open()) {
        std::cerr << "Failed to open file: " << filename << std::endl;
        return;
    }

    csv << "Index,frame\n";

    // 写入数据
    for (size_t i = 0; i < frame.size(); ++i) {
        csv << i << "," << frame[i] << "\n";
    }

    // 关闭文件
    csv.close();

    std::cout << "Data successfully written to " << filename << std::endl;
}