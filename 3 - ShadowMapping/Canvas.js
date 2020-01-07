
// Code referred from WebGL_Programming_Guide by Kouichi Matsuda and Rodger Lea
// and opengl_programming_guide_8th_edition.pdf

// global variables
var canvas = null;
var gl = null;
var bFullscreen = false;
var canvas_original_width;
var canvas_original_height;

var WebGLMacros = 
{
	VDG_ATTRIBUTE_VERTEX:0,
	VDG_ATTRIBUTE_COLOR:1,
	VDG_ATTRIBUTE_NORMAL:2,
	VDG_ATTRIBUTE_TEXTURE0:3,
};

var perspectiveProjectionMatrix;

var vertexShaderObject;
var fragmentShaderObject;
var p1_shaderProgramObject;
var p2_shaderProgramObject;

var model_view_matrix;
var rotation_matrix;
var projection_matrix;
var projection_matrix_from_light_point_of_view;
var scale_matrix;
var mvpUniform_1, mvpUniform_2;
var model_matrix_uniform_2, view_matrix_uniform_2, projection_matrix_uniform_2, mvp_matrix_from_light_point_of_view_cube, mvp_matrix_from_light_point_of_view_quad;

var vao_quad;
var vbo_quad_position;
var vbo_quad_color;
var vbo_quad_normal;

var vao_cube;
var vbo_cube_position;
var vbo_cube_color;
var vbo_cube_normal;

var depth_texture;
var shadow_width = 1024;
var shadow_height = 1024;
var depth_fbo;

var light_point_of_view_eye = [0.5, 1.0, -0.5];
var eye = [0.0, 1.0, 1.0];
var center = [0.0, 0.0, 0.0];
var up = [0.0, 1.0, 0.0];

var framebuffer;
var texture;
var depthBuffer;

var light_position_uniform;
var texture0_sampler_uniform;

var angle = 0;

var light_ambient = [0.0, 0.0, 0.0];
var light_diffuse = [1.0, 1.0, 1.0];
var light_specular = [1.0, 1.0, 1.0];

// var material_ambient = [0.0, 0.0, 0.0];
// var material_diffuse = [1.0, 1.0, 1.0];
// var material_specular = [1.0, 1.0, 1.0];
// var material_shininess = 50.0;

var material_ambient = [0.0215,0.1745,0.0215];
var material_diffuse = [0.07568,0.61424,0.07568];
var material_specular = [0.633,0.727811,0.633];
var material_shininess = 0.6 * 128.0;

var la_uniform, ld_uniform, ls_uniform;
var ka_uniform, kd_uniform, ks_uniform, material_shininess_uniform;

var angleCube = 0.0;

// to start animation : To have requestAnimationFrame to be called "cross browser" compatible
var requestAnimationFrame = 
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame;

// to stop animation : To have cancelAnimationFrame() to be called "cross browser" compatible
var cancelAnimationFrame = 
        window.cancelAnimationFrame ||
        window.webkitCancelRequestAnimationFrame ||
        window.webkitCancelAnimationFrame ||
        window.mozCancelRequestAnimationFrame ||
        window.mozCancelAnimationFrame ||
        window.oCancelRequestAnimationFrame ||
        window.oCancelAnimationFrame ||
        window.msCancelRequestAnimationFrame ||
        window.msCancelAnimationFrame;

// onload function
function main()
{
    // get canvas element
    canvas = document.getElementById("AMC");
    if(!canvas)
        console.log("Obtaining canvas failed\n");
    else
        console.log("Obtaining canvas succeded\n");

    canvas_original_width = canvas.width;
    canvas_original_height = canvas.height;
    
    // register keyboard's keydown event handler
    window.addEventListener("keydown",keyDown,false);
    window.addEventListener("click",mouseDown,false);
    window.addEventListener("resize",resize,false);
    
    // initialize webgl
    init();
    
    // start drawing here as warming up
    resize(0, 0, canvas_original_width, canvas_original_height, perspectiveProjectionMatrix);
    draw();
}

function toggleFullscreen(){
    var fullscreen_element = 
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullscreenElement ||
            document.msFullscreenElement ||
            null;
    
    // if not fullscreen
    if(fullscreen_element == null){
        if(canvas.requestFullscreen)
            canvas.requestFullscreen();
        else if(canvas.mozRequestFullScreen)
            canvas.mozRequestFullScreen();
        else if(canvas.webkitRequestFullscreen)
            canvas.webkitRequestFullscreen();
        else if(canvas.msRequestFullscreen)
            canvas.msRequestFullscreen();
        bFullscreen = true;
    } else {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        else if(document.msExitFullscreen)
            document.msExitFullscreen();
        bFullscreen = false;
    }
}

function init(){
    // get webgl 2.0 context
    gl = canvas.getContext("webgl2");
    if(gl==null){
        console.log("Failed to get rendering context for webgl");
        return;
    }
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    
    p1_vertexShaderStage();
    p1_fragmentShaderStage();
    p1_linkProgram();
    
    p2_vertexShaderStage();
    p2_fragmentShaderStage();
    p2_linkProgram();

    initVertexBufferForQuad();
    initVertexBufferForCube();
    initFramebufferObject();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // set clear color
    gl.clearColor(0.0,0.8,0.99,1.0);

    perspectiveProjectionMatrix = mat4.create();
}

function resize(x, y, width, height, projectionMatrix)
{
    if(bFullscreen == true){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = canvas_original_width;
        canvas.height = canvas_original_height;
    }
   
    // set the viewport to match
    gl.viewport(x, y, width, height);
    mat4.perspective(projectionMatrix, 45.0, parseFloat(width)/parseFloat(height), 0.1, 100.0);
}

// vertex shader for creating depth map
function p1_vertexShaderStage()
{
    // vertex shader
    var vertexShaderSourceCode = 
    "#version 300 es"+
    "\n"+
    "in vec4 vPosition;"+
    "uniform mat4 u_mvp_matrix;"+
    "void main(void)"+
    "{"+
    "gl_Position = u_mvp_matrix * vPosition;"+
    "}";

    // create and compile vertex shader
    vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);
    if(gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) == false)
    {
    	var error = gl.getShaderInfoLog(vertexShaderObject);
    	if(error.length > 0)
    	{
    		alert(error);
    		uninitialize();
    	}
    }
}

// fragment shader for creating depth map (pass 1)
function p1_fragmentShaderStage()
{
    var fragmentShaderSourceCode = 
    "#version 300 es"+
    "\n"+
    "precision highp float;"+
    "out vec4 FragColor;"+
    "void main(void)"+
    "{"+
    // When the distance from light source to object is increased, then value of glFragCoord.z can not be stored in R component of texture map because it has only 8 bit precision
    // A simple solution to this problem is to use not just the R component but B, G and A components also
    // Below 3 line splits gl_FragCoord.z into 4 bytes(RGBA)
    "const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);"+
    "const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);"+
    "vec4 rgbaDepth = fract(gl_FragCoord.z * bitShift);"+
    "rgbaDepth -= rgbaDepth.gbaa * bitMask;"+
    "FragColor = rgbaDepth;"+
    "}";

    // create and compile fragment shader
    fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);
    if(gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) == false)
    {
    	var error = gl.getShaderInfoLog(fragmentShaderObject);
    	if(error.length > 0)
    	{
	    	alert('Fragment Shader - '+error);
	    	uninitialize();
    	}
    }
}

// link program for depth map (pass 1)
function p1_linkProgram()
{
    // create shader program
    p1_shaderProgramObject = gl.createProgram();
    // attach vertex and fragment shader
    gl.attachShader(p1_shaderProgramObject, vertexShaderObject);
    gl.attachShader(p1_shaderProgramObject, fragmentShaderObject);

    // pre-link binding of shader program object with vertex shader attributes
    gl.bindAttribLocation(p1_shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_VERTEX, "vPosition");

    // linking
    gl.linkProgram(p1_shaderProgramObject);
    if(!gl.getProgramParameter(p1_shaderProgramObject, gl.LINK_STATUS))
    {
        var error = gl.getProgramInfoLog(p1_shaderProgramObject);
        if(error.length > 0)
        {
            alert(error);
            uninitialize();
        }
    }

    // get location of model-view-projection matrix uniform
   	mvpUniform_1 = gl.getUniformLocation(p1_shaderProgramObject, "u_mvp_matrix");
}

// vertex shader for normal scene (pass 2)
function p2_vertexShaderStage()
{
    var vertexShaderSourceCode = 
    "#version 300 es"+
    "\n"+
    "in vec4 vPosition;"+
    "in vec4 vColor;"+
    "in vec3 vNormal;"+
    "uniform vec3 u_la;"+
    "uniform vec3 u_ld;"+
    "uniform vec3 u_ls;"+
    "uniform vec3 u_ka;"+
    "uniform vec3 u_kd;"+
    "uniform vec3 u_ks;"+
    "uniform float u_material_shininess;"+
    "uniform vec3 u_light_position;"+
    //"uniform mat4 u_mvp_matrix;"+
    "uniform mat4 u_model_matrix;"+
    "uniform mat4 u_view_matrix;"+
    "uniform mat4 u_projection_matrix;"+
    "uniform mat4 u_mvp_matrix_from_light_point_of_view;"+
    "out vec4 out_vPositionFromLight;"+
    "out vec4 out_color;"+
    "void main()"+
    "{"+
    "vec4 eye_coordinates = u_view_matrix * u_model_matrix * vPosition;"+
    "vec3 transformed_normals = normalize(mat3(u_view_matrix * u_model_matrix) * vNormal);"+
    "vec3 light_direction = normalize(vec3(u_light_position) - eye_coordinates.xyz);"+
    "vec3 reflection_vector = reflect(-light_direction, transformed_normals);"+
    "vec3 viewer_vector = normalize(-eye_coordinates.xyz);"+
    "vec3 ambient = u_la * u_ka;"+
    "float tn_dot_ld = max(dot(transformed_normals, light_direction), 0.0);"+
    "vec3 diffuse = u_ld * u_kd * tn_dot_ld;"+
    "vec3 specular = u_ls * u_ks * pow(max(dot(reflection_vector, viewer_vector), 0.0), u_material_shininess);"+
    "vec3 phong_ads_color = ambient + diffuse + specular;"+
    // This operation calculates the coordinates of each fragment from light source and pass them to fragment shader to obtain the z value of each fragment from the light source
    "out_vPositionFromLight = u_mvp_matrix_from_light_point_of_view * vPosition;"+
    "gl_Position = u_projection_matrix * u_view_matrix * u_model_matrix * vPosition;"+
    "out_color = vColor;"+
    "out_color = vColor + vec4(phong_ads_color, 1.0);"+
    "}";

    vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);
    if(!gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS))
    {
        var error = gl.getShaderInfoLog(vertexShaderObject);
        if(error.length > 0)
        {
            alert(error);
            uninitialize();
        }
    }
}

// fragment shader for rendering normal scene (pass 2)
function p2_fragmentShaderStage()
{
    var fragmentShaderSourceCode = 
    "#version 300 es"+
    "\n"+
    "precision highp float;"+
    "uniform sampler2D u_shadow_map;"+
    "in vec4 out_vPositionFromLight;"+
    "in vec4 out_color;"+
    "out vec4 FragColor;"+
    "float unpackDepth(const in vec4 rgbaDepth)"+
    "{"+
    "const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0 * 256.0), 1.0/(256.0 * 256.0 * 256.0));"+
    "float depth = dot(rgbaDepth, bitShift);"+
    "return depth;"+
    "}"+
    "void main()"+
    "{"+
    // This operation will give you z value to compare with the value in the shadow map
    // Shadow map contains the value of (gl_Position.z / gl_Position.w) / 2.0 + 5.0
    // Same way, you can calculate the z value to compare with the value in shadow map using (out_vPositionFromLight.z / out_vPositionFromLight.w) / 2.0 + 5.0
    // See Section 2.12 of the OpenGL ES 2.0 specification for further details about this calculation.
    // www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf 
    // However, because you need to get texel value from shadow map, below line performs extra calculation using same operation
    // To compare to the value in shadow map, you need to get texel value from shadow map whose texture coordinates corrospond to coordinates out_vPositionFromLight.x and out_vPositionFromLight.y
    // But out_vPositionFromLight.x and out_vPositionFromLight.y are the x and y coordiantes of WebGL Coordinate System and they range from -1 to 1
    // On the other hand, texture coordinates s and t in the shadow map range from 0 to 1, so you need to convert x and y coordiantes to s and t coordinates
    // This can be done with the same expression to calculate z value
    "vec3 shadowCoord = (out_vPositionFromLight.xyz / out_vPositionFromLight.w) / 2.0 + 0.5;"+
    // Retrive the value from shadow map
    "vec4 rgbaDepth = texture(u_shadow_map, shadowCoord.xy);"+
    // Only the r value is retrieved using rgbaDepth.r because you wrote it into R component at line 223
    // It is nothing but the z value from shadowMap which we calculated in pass1
    "float depth = unpackDepth(rgbaDepth);"+
    // When position of the fragment is determined to be greater than depth, a value of 0.7 is stored in visibility
    // The visibility is used in below operation to draw the shadow with darker color
    // Small offset of 0.0020 is added to depth value. To understand why this is needed, try running the sample program without this number. You will see striped pattern
    "float visibility = (shadowCoord.z > depth + 0.0020) ? 0.7 : 1.0;"+
    "FragColor = vec4(out_color.rgb * visibility, out_color.a);"+
    "}";

    fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);
    if(!gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS))
    {
        var error = gl.getShaderInfoLog(fragmentShaderObject);
        alert(error);
        uninitialize();
    }
}

// link program for rendering normal scene (pass 2)
function p2_linkProgram()
{
	// create program object
    p2_shaderProgramObject = gl.createProgram();

    // attach vertex and fragment shader object
    gl.attachShader(p2_shaderProgramObject, vertexShaderObject);
    gl.attachShader(p2_shaderProgramObject, fragmentShaderObject);

    // pre-link binding of shader program object with vertex, color and normal shader attributes
    gl.bindAttribLocation(p2_shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_VERTEX, "vPosition");
    gl.bindAttribLocation(p2_shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_COLOR, "vColor");
    gl.bindAttribLocation(p2_shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_NORMAL, "vNormal");

    gl.linkProgram(p2_shaderProgramObject);
    if(!gl.getProgramParameter(p2_shaderProgramObject, gl.LINK_STATUS))
    {
        var error = gl.getProgramInfoLog(p2_shaderProgramObject);
        if(error.length > 0)
        {
            alert(error);
            uninitialize();
        }
    }

    // get location of ambient, diffuse and specular light uniform
    la_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_la");
    ld_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_ld");
    ls_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_ls");

    // get location of ambient, diffuse and specular material uniform
    ka_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_ka");
    kd_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_kd");
    ks_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_ks");
    material_shininess_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_material_shininess");

    // get location of model, view and projection matrix uniforms
	//mvpUniform_2 = gl.getUniformLocation(p2_shaderProgramObject, "u_mvp_matrix");
	model_matrix_uniform_2 = gl.getUniformLocation(p2_shaderProgramObject, "u_model_matrix");
	view_matrix_uniform_2 = gl.getUniformLocation(p2_shaderProgramObject, "u_view_matrix");
	projection_matrix_uniform_2 = gl.getUniformLocation(p2_shaderProgramObject, "u_projection_matrix");

    // get location of light position uniform
    light_position_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_light_position");

	// get location of model view projection matrix uniform from light point of view
	mvpUniformFromLightPointOfView = gl.getUniformLocation(p2_shaderProgramObject, "u_mvp_matrix_from_light_point_of_view");
	// get location of shadow map uniform
    texture0_sampler_uniform = gl.getUniformLocation(p2_shaderProgramObject, "u_shadow_map");
}

function initVertexBufferForQuad()
{
    var quadVertices = new Float32Array([
    	1.0, 0.0, -1.0,
    	-1.0, 0.0, -1.0,
    	-1.0, 0.0, 1.0,
    	1.0, 0.0, 1.0
    ]);

    var quadColor = new Float32Array([
    	0.8, 0.8, 0.8,
    	0.8, 0.8, 0.8,
    	0.8, 0.8, 0.8,
    	0.8, 0.8, 0.8
    ]);

    var quadNormal = new Float32Array([
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0
    ]);

    // *************************
    // VAO FOR QUAD
    // *************************
    vao_quad = gl.createVertexArray();
    gl.bindVertexArray(vao_quad);
    // *************************
    // VBO FOR QUAD POSITION
    // *************************
    vbo_quad_position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_quad_position);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_VERTEX, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_VERTEX);
    gl.bindBuffer(gl.ARRAY_BUFFER,null);
    // *************************
    // VBO FOR QUAD COLOR
    // *************************
    vbo_quad_color = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_quad_color);
    gl.bufferData(gl.ARRAY_BUFFER, quadColor, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_COLOR, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_COLOR);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    // *************************
    // VBO FOR QUAD NORMALS
    // *************************
    vbo_quad_normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_quad_normal);
    gl.bufferData(gl.ARRAY_BUFFER, quadNormal, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_NORMAL, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_NORMAL);
}

function initVertexBufferForCube()
{
    var cubeVertices = new Float32Array([
    	// FRONT FACE
    	1.0, 1.0, 1.0,
    	-1.0, 1.0, 1.0,
    	-1.0, -1.0, 1.0,
    	1.0, -1.0, 1.0,

        // RIGHT FACE
        1.0,1.0,-1.0,
        1.0,1.0,1.0,
        1.0,-1.0,1.0,
        1.0,-1.0,-1.0,
        
        // BACK FACE
        1.0,1.0,-1.0,
        -1.0,1.0,-1.0,
        -1.0,-1.0,-1.0,
        1.0,-1.0,-1.0,
        
        // LEFT FACE
        -1.0,1.0,1.0,
        -1.0,1.0,-1.0,
        -1.0,-1.0,-1.0,
        -1.0,-1.0,1.0,
        
        // TOP FACE
        1.0,1.0,-1.0,
        -1.0,1.0,-1.0,
        -1.0,1.0,1.0,
        1.0,1.0,1.0,
        
        // BOTTOM FACE
        1.0,-1.0,-1.0,
        -1.0,-1.0,-1.0,
        -1.0,-1.0,1.0,
        1.0,-1.0,1.0 
    ]);

    var cubeColor = new Float32Array([
    	// FRONT FACE
    	1.0, 0.0, 0.0,
    	1.0, 0.0, 0.0,
    	1.0, 0.0, 0.0,
    	1.0, 0.0, 0.0,

        // RIGHT FACE
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        
        // BACK FACE
        1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        
        // LEFT FACE
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        
        // TOP FACE
        0.0, 1.0, 1.0,
        0.0, 1.0, 1.0,
        0.0, 1.0, 1.0,
        0.0, 1.0, 1.0,
        
        // BOTTOM FACE
        1.0, 0.0, 1.0,
        1.0, 0.0, 1.0,
        1.0, 0.0, 1.0,
        1.0, 0.0, 1.0
    ]);

    var cubeNormals = new Float32Array([
    	// FRONT FACE
    	0.0, 0.0, 1.0,
    	0.0, 0.0, 1.0,
    	0.0, 0.0, 1.0,
    	0.0, 0.0, 1.0,

        // RIGHT FACE
        1.0,0.0,0.0,
        1.0,0.0,0.0,
        1.0,0.0,0.0,
        1.0,0.0,0.0,
        
        // BACK FACE
        0.0,0.0,-1.0,
        0.0,0.0,-1.0,
        0.0,0.0,-1.0,
        0.0,0.0,-1.0,
        
        // LEFT FACE
        -1.0,0.0,0.0,
        -1.0,0.0,0.0,
        -1.0,0.0,0.0,
        -1.0,0.0,0.0,
        
        // TOP FACE
        0.0,1.0,0.0,
        0.0,1.0,0.0,
        0.0,1.0,0.0,
        0.0,1.0,0.0,
        
        // BOTTOM FACE
        0.0,-1.0,0.0,
        0.0,-1.0,0.0,
        0.0,-1.0,0.0,
        0.0,-1.0,0.0
    ]);

    // *************************
    // VAO FOR CUBE
    // *************************
    vao_cube = gl.createVertexArray();
    gl.bindVertexArray(vao_cube);
    // *************************
    // VBO FOR CUBE POSITION
    // *************************
    vbo_cube_position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_cube_position);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_VERTEX, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_VERTEX);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    // *************************
    // VBO FOR CUBE COLOR
    // *************************
    // vbo_cube_color = gl.createBuffer();
    // gl.bindBuffer(gl.ARRAY_BUFFER, vbo_cube_color);
    // gl.bufferData(gl.ARRAY_BUFFER, cubeColor, gl.STATIC_DRAW);
    // gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_COLOR, 3, gl.FLOAT, false, 0, 0);
    // gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_COLOR);
    // gl.bindBuffer(gl.ARRAY_BUFFER, null);
    // gl.bindVertexArray(null);
    // *************************
    // VBO FOR CUBE NORMAL
    // *************************
    vbo_cube_normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_cube_normal);
    gl.bufferData(gl.ARRAY_BUFFER, cubeNormals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_NORMAL, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_NORMAL);
}

function initFramebufferObject()
{
    // create a framebuffer object
    framebuffer = gl.createFramebuffer();
    // create a texture object
    texture = gl.createTexture();
    // bind texture to target
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // set texture size and parameters
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadow_width, shadow_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // texture minification filter
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // texture magnification filer
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // set up depth comparison mode
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    // setup wrapping modes
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // store texture in framebuffer
    framebuffer.texture = texture;
    // create a renderbuffer object
    depthBuffer = gl.createRenderbuffer();
    // bind renderbuffer object to target
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    // set renderbuffer size and parameters
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadow_width, shadow_height);
    // bind framebuffer object to target
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // attach texture object to framebuffer object
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    // attach renderbuffer object to framebuffer object
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    // check whether FBO is configured correctly
    var e = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(e !== gl.FRAMEBUFFER_COMPLETE)
    {
        console.log("Framebuffer object is incomplete - "+e.toString());
        return error();
    }
}

function draw()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // depth map generation
    pass1();
    // normal scene rendering
    pass2();

    // animation loop
    requestAnimationFrame(draw,canvas);
}

// Shadow mapping is a multipass technique.
// This is pass 1 includes below steps
// 1. Bind to framebuffer object
// 2. Render the scene from the point of view of light source.
// 3. Draw the objects
// NOTE : This step creates a shadow map by writing distances from the light source to each fragment in the texture image
function pass1()
{
    // set texture object to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
	// bind framebuffer object to target
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // bind texture to target
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture);
    // initialize projection matrix from light point of view
    projection_matrix_from_light_point_of_view = mat4.create();
    // set viewport and projection matrix, also set viewport to the size of depth texture
    resize(0, 0, shadow_width, shadow_height, projection_matrix_from_light_point_of_view);
    // set lookat matrix
    //mat4.lookAt(projection_matrix_from_light_point_of_view, light_point_of_view_eye, center, up);
    // specify depth value to clear
    gl.clearDepth(1.0);
    // clear depth buffer
    gl.clear(gl.DEPTH_BUFFER_BIT);
    // enable polygon offset to resolve depth fighting issues
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 4.0);
    // render the scene
    drawSceneFromLightPointOfView();
    // disable polygon offset fill
    gl.disable(gl.POLYGON_OFFSET_FILL);
	// change drawing destination again back to default buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawSceneFromLightPointOfView()
{
    gl.useProgram(p1_shaderProgramObject);

	// RENDER CUBE

    // initialize model, view and scale matrix
    model_view_matrix = mat4.create();
    scale_matrix = mat4.create();
    projection_matrix = mat4.create();

    light_point_of_view_eye[0] = 1.0 * Math.sin(angle);
    light_point_of_view_eye[2] = 1.0 * Math.cos(angle);
    angle += 0.01;

    // set lookat matrix
    mat4.lookAt(model_view_matrix, light_point_of_view_eye, center, up);
    // set transformations
    mat4.translate(model_view_matrix, model_view_matrix, [0.0, 0.3, 0.0]);
    // rotate cube
    mat4.rotateX(model_view_matrix, model_view_matrix, degToRad(angleCube));
    mat4.rotateY(model_view_matrix, model_view_matrix, degToRad(angleCube));
    mat4.rotateZ(model_view_matrix, model_view_matrix, degToRad(angleCube));
    // set scale
    mat4.scale(scale_matrix, scale_matrix, [0.1, 0.1, 0.1]);
    // multiply model-view and scale matrix
    mat4.multiply(model_view_matrix, model_view_matrix, scale_matrix);
    // multiply projection matrix from light point of view and model-view matrix
    mat4.multiply(projection_matrix, projection_matrix_from_light_point_of_view, model_view_matrix);
    // set uniform for model-view-projection matrix
    gl.uniformMatrix4fv(mvpUniform_1, false, projection_matrix);
    // draw cube
    drawCube(vao_cube);

    // mvpmatrix for cube from light point of view and will be used in pass 2
    mvp_matrix_from_light_point_of_view_cube = mat4.create();
    mat4.multiply(mvp_matrix_from_light_point_of_view_cube, mvp_matrix_from_light_point_of_view_cube, projection_matrix);

    // RENDER QUAD

    // initialize model, view, projection and scale matrix
    model_view_matrix = mat4.create();
    projection_matrix = mat4.create();
    // set lookat matrix
    mat4.lookAt(model_view_matrix, light_point_of_view_eye, center, up);
    // set transformations
    mat4.translate(model_view_matrix, model_view_matrix, [0.0, 0.0, 0.0]);
    // set projection matrix
    mat4.multiply(projection_matrix, projection_matrix_from_light_point_of_view, model_view_matrix);
    // set uniform for model-view-projection matrix
	gl.uniformMatrix4fv(mvpUniform_1, false, projection_matrix);
    // draw quad
	drawQuad(vao_quad);

    // mvpmatrix for quad from light point of view and will be used in pass 2
    mvp_matrix_from_light_point_of_view_quad = mat4.create();
    mat4.multiply(mvp_matrix_from_light_point_of_view_quad, mvp_matrix_from_light_point_of_view_quad, projection_matrix);

    gl.useProgram(null);
}

function pass2()
{
    projection_matrix_from_normal_point_of_view = mat4.create();
    // set viewport to the position from which you want to view the objects
    resize(0, 0, canvas_original_width, canvas_original_height, projection_matrix_from_normal_point_of_view);
    drawNormalScene();
}

function drawNormalScene()
{
    gl.useProgram(p2_shaderProgramObject);

    gl.uniform3fv(la_uniform, light_ambient);
    gl.uniform3fv(ld_uniform, light_diffuse);
    gl.uniform3fv(ls_uniform, light_specular);

    gl.uniform3fv(ka_uniform, material_ambient);
    gl.uniform3fv(kd_uniform, material_diffuse);
    gl.uniform3fv(ks_uniform, material_specular);
    gl.uniform1f(material_shininess_uniform, material_shininess);

    // RENDER CUBE

    model_matrix = mat4.create();
    view_matrix = mat4.create();
    scale_matrix = mat4.create();

    // eye[0] = 1.0 * Math.sin(angle);
    // eye[2] = 1.0 * Math.cos(angle);
    // angle += 0.01;

    // set lookat matrix
    mat4.lookAt(view_matrix, eye, center, up);
    // set transformations
    mat4.translate(model_matrix, model_matrix, [0.0, 0.3, 0.0]);
    // rotate cube
    mat4.rotateX(model_matrix, model_matrix, degToRad(angleCube));
    mat4.rotateY(model_matrix, model_matrix, degToRad(angleCube));
    mat4.rotateZ(model_matrix, model_matrix, degToRad(angleCube));
    angleCube = angleCube + 1.0;
    if(angleCube > 360.0)
        angleCube = 0.0;
    // scale cube
    mat4.scale(scale_matrix, scale_matrix, [0.1, 0.1, 0.1]);
    // multiply model-view and scale matrix
    mat4.multiply(model_matrix, model_matrix, scale_matrix);
    // pass model matrix uniform for normal rendering
    gl.uniformMatrix4fv(model_matrix_uniform_2, false, model_matrix);
    // pass view matrix uniform for normal rendering
    gl.uniformMatrix4fv(view_matrix_uniform_2, false, view_matrix);
    // pass projection matrix uniform for normal rendering
    gl.uniformMatrix4fv(projection_matrix_uniform_2, false, projection_matrix_from_normal_point_of_view);
    // pass mvp matrix from light point of view
    gl.uniformMatrix4fv(mvpUniformFromLightPointOfView, false, mvp_matrix_from_light_point_of_view_cube);
    // pass light position uniform
    gl.uniform3fv(light_position_uniform, light_point_of_view_eye);
    // pass gl.TEXTURE0
    gl.uniform1i(texture0_sampler_uniform, 0);
    // draw cube
    drawCube(vao_cube);

    // RENDER QUAD

    model_matrix = mat4.create();
    view_matrix = mat4.create();

    // set lookat matrix
    mat4.lookAt(view_matrix, eye, center, up);
    // set transformations
    mat4.translate(model_matrix, model_matrix, [0.0, 0.0, 0.0]);
    // pass model matrix uniform for normal rendering 
    gl.uniformMatrix4fv(model_matrix_uniform_2, false, model_matrix);
    // pass view matrix uniform for normal rendering 
    gl.uniformMatrix4fv(view_matrix_uniform_2, false, view_matrix);
    // pass projection matrix uniform for normal rendering 
    gl.uniformMatrix4fv(projection_matrix_uniform_2, false, projection_matrix_from_normal_point_of_view);
    // pass mvp matrix from light point of view
    gl.uniformMatrix4fv(mvpUniformFromLightPointOfView, false, mvp_matrix_from_light_point_of_view_quad);
    // pass light position uniform
    gl.uniform3fv(light_position_uniform, light_point_of_view_eye);
    // pass gl.TEXTURE0
    gl.uniform1i(texture0_sampler_uniform, 0);
    // draw quad
    drawQuad(vao_quad);

    gl.useProgram(null);
}

function drawCube(vao)
{
    // bind with cube vertex array object
    gl.bindVertexArray(vao);
    // draw cube using gl.drawArrays
    gl.drawArrays(gl.TRIANGLE_FAN,0,4);
    gl.drawArrays(gl.TRIANGLE_FAN,4,4);
    gl.drawArrays(gl.TRIANGLE_FAN,8,4);
    gl.drawArrays(gl.TRIANGLE_FAN,12,4);
    gl.drawArrays(gl.TRIANGLE_FAN,16,4);
    gl.drawArrays(gl.TRIANGLE_FAN,20,4);
    // unbind cube vertex array object
    gl.bindVertexArray(null);
}

function drawQuad(vao)
{
    // bind with quad vertex array object
    gl.bindVertexArray(vao);
    // draw quad using gl.drawArrays
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	// unbind quad vertex array object
    gl.bindVertexArray(null);
}

function degToRad(degrees)
{
    return(degrees * Math.PI / 180);
}

function keyDown(event){
    switch(event.keyCode){
        case 70:    // for F or f
            toggleFullscreen();
            break;
    }
}

function mouseDown(event){
    //alert("Mouse is clicked");
}

function uninitialize(){
}
