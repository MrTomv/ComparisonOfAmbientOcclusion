#ifndef UTILS_H
#define UTILS_H
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>
#include <shader_s.h>
#include <iostream>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <Camera.h>

// settings
const unsigned int WIDTH = 1280;
const unsigned int HEIGHT = 960;
bool bn = false;
bool bnKeyPress = false;

// cam
Camera cam(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX_axis = WIDTH / 2.0f;
float lastY_axis = HEIGHT / 2.0f;
bool fMouse = true;

// timing
float deltaT = 0.0f;
float lastF = 0.0f;
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and 
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        cam.ProcessKeyboard(FORWARD, deltaT);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        cam.ProcessKeyboard(BACKWARD, deltaT);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        cam.ProcessKeyboard(LEFT, deltaT);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        cam.ProcessKeyboard(RIGHT, deltaT);
    if (glfwGetKey(window, GLFW_KEY_B) == GLFW_PRESS && !bnKeyPress)
    {
        bn = !bn;
        bnKeyPress = true;
    }
    if (glfwGetKey(window, GLFW_KEY_B) == GLFW_RELEASE)
    {
        bnKeyPress = false;
    }
}

// glfw: whenever the mouse moves, this callback is called
// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (fMouse)
    {
        lastX_axis = xpos;
        lastY_axis = ypos;
        fMouse = false;
    }

    float xoffset = xpos - lastX_axis;
    float yoffset = lastY_axis - ypos; // reversed since y-coordinates go from bottom to top

    lastX_axis = xpos;
    lastY_axis = ypos;

    cam.ProcessMouseMovement(xoffset, yoffset);
}

// glfw: whenever the mouse scroll wheel scrolls, this callback is called
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    cam.ProcessMouseScroll(static_cast<float>(yoffset));
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
#endif
