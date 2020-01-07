
// global variables
var canvas = null;
var gl = null;
var bFullscreen = false;
var canvas_origional_width;
var canvas_origional_height;
var logEnabled = 1;

const WebGLMacros = 
{
    VDG_ATTRIBUTE_VERTEX:0,
    VDG_ATTRIBUTE_COLOR:1,
    VDG_ATTRIBUTE_NORMAL:2,
    VDG_ATTRIBUTE_TEXTURE:3,
};

var vertexShaderObject;
var fragmentShaderObject;
var shaderProgramObject;

var modelMatrixUniform, viewMatrixUniform, projectionMatrixUniform;

var vao_square;
var vbo_square_position;
var vbo_square_color;
var vbo_square_normal;

var light_ambient = [0.0,0.0,0.0];
var light_diffuse = [1.0,1.0,1.0];
var light_specular = [1.0,1.0,1.0];

var material_ambient = [0.0,0.05,0.0];
var material_diffuse = [0.4,0.5,0.4];
var material_specular = [0.04,0.7,0.04];
var material_shininess = 0.6 * 128.0;

var light_position = [0.0,0.0,0.0,0.0];

var la_uniform, ld_uniform, ls_uniform;
var ka_uniform, kd_uniform, ks_uniform;
var light_position_uniform, material_shininess_uniform;

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
        window.webkitCancelRequestAnimationFrmae ||
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
        consoleLog("Obtaining canvas failed\n");
    else
        consoleLog("Obtaining canvas succeded\n");

    canvas_origional_width = canvas.width;
    canvas_origional_height = canvas.height;

    // register keyboard's keydown event handler
    window.addEventListener("keydown",keyDown,false);
    window.addEventListener("click",mouseDown,false);
    window.addEventListener("resize",resize,false);
    
    // initialize webgl
    init();
    
    // start drawing here as warming up
    resize();
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
        consoleLog("Failed to get rendering context for webgl");
        return;
    }
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    
    // vertex shader
    var vertexShaderSourceCode = 
        "#version 300 es"+
        "\n"+
        "in vec4 vPosition;"+
        "in vec3 vNormal;"+

        "uniform mat4 u_model_matrix;"+
        "uniform mat4 u_view_matrix;"+
        "uniform mat4 u_projection_matrix;"+
        "uniform vec4 u_light_position;"+

        "out vec3 transformed_normals;"+
        "out vec3 light_direction;"+
        "out vec3 viewer_vector;"+
        "out vec2 MCPosition;"+

        "void main(void)"+
        "{"+

        // transform vertex position into eye coordinates for use in lighting computation
        "vec4 eyeCoordinates = u_view_matrix * u_model_matrix * vPosition;"+
        "transformed_normals = mat3(u_view_matrix * u_model_matrix) * vNormal;"+
        "light_direction = vec3(u_light_position) - eyeCoordinates.xyz;"+
        "viewer_vector = -eyeCoordinates.xyz;"+

        // To generate brick pattern algorithmically in fragment shader, we need to provide a value at each fragment that represents a location on the surface
        "MCPosition = vPosition.xy;"+

        "gl_Position = u_projection_matrix * u_view_matrix * u_model_matrix * vPosition;"+
        "}";

    vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);
    var vertexShaderCompileStatus = gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS);
    if(vertexShaderCompileStatus == false)
    {
        var error = gl.getShaderInfoLog(vertexShaderObject);
        if(error.length > 0)
        {
            consoleLog("Vertex shader error  - "+error);
            uninitialize();
        }
    }
    else if(vertexShaderCompileStatus == true)
    {
        consoleLog("Vertex shader succeeded");
    }

    // fragment shader
    var fragmentShaderSourceCode = 
        "#version 300 es"+
        "\n"+
        "precision highp float;"+

        "in vec3 transformed_normals;"+
        "in vec3 light_direction;"+
        "in vec3 viewer_vector;"+
        "in vec2 MCPosition;"+
        
        "uniform vec3 u_la;"+
        "uniform vec3 u_ld;"+
        "uniform vec3 u_ls;"+
        "uniform vec3 u_ka;"+
        "uniform vec3 u_kd;"+
        "uniform vec3 u_ks;"+
        "uniform float u_material_shininess;"+

        "out vec4 FragColor;"+

        "void main(void)"+
        "{"+
        "vec3 phong_ads_color;"+
        "vec3 normalized_transformed_normals = normalize(transformed_normals);"+
        "vec3 normalized_light_direction = normalize(light_direction);"+
        "vec3 normalized_viewer_vector = normalize(viewer_vector);"+

        // ambient component
        "vec3 ambient = u_la * u_ka;"+

        // If angle between transformed normal and light direction is > 90, then dot product will be negative
        // and we will end up with negative diffuse component
        // To avoid this, we use max function that returns highest of both its parameters to make sure diffuse component never become negative
        "float tn_dot_ld = max(dot(normalized_transformed_normals, normalized_light_direction), 0.0);"+
        // diffuse component
        "vec3 diffuse = u_ld * u_kd * tn_dot_ld;"+

        // calculate reflection vector
        "vec3 reflection_vector = reflect(-normalized_light_direction, normalized_transformed_normals);"+
        // specular  component
        "vec3 specular = u_ls * u_ks * pow(max(dot(reflection_vector, normalized_viewer_vector),0.0), u_material_shininess);"+

        // calculate phong lighting color
        "phong_ads_color = ambient + diffuse + specular;"+

        "FragColor = vec4(phong_ads_color, 1.0);"+
        "}";

    fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);
    var fragmentShaderCompileStatus = gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS);
    if(fragmentShaderCompileStatus == false)
    {
        var error = gl.getShaderInfoLog(fragmentShaderObject);
        if(error.length > 0)
        {
            consoleLog("Fragment shader error  - "+error);
            uninitialize();
        }
    }
    else if(fragmentShaderCompileStatus == true)
    {
        consoleLog("Fragment shader succeeded");
    }

    // shader program
    shaderProgramObject = gl.createProgram();
    gl.attachShader(shaderProgramObject, vertexShaderObject);
    gl.attachShader(shaderProgramObject, fragmentShaderObject);

    // pre-link binding of shader program object with vertex attributes
    gl.bindAttribLocation(shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_VERTEX, "vPosition");
    gl.bindAttribLocation(shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_NORMAL, "vNormal");

    // Linking
    gl.linkProgram(shaderProgramObject);
    if(!gl.getProgramParameter(shaderProgramObject, gl.LINK_STATUS))
    {
        var error = gl.getProgramInfoLog(shaderProgramObject)
        if(error.length > 0)
        {
            alert(error);
            uninitialize();
        }
    }

    // get model matrix uniform location
    modelMatrixUniform = gl.getUniformLocation(shaderProgramObject,"u_model_matrix");
    // get view matrix uniform location
    viewMatrixUniform = gl.getUniformLocation(shaderProgramObject,"u_view_matrix");
    // get projection matrix uniform location
    projectionMatrixUniform = gl.getUniformLocation(shaderProgramObject,"u_projection_matrix");

    la_uniform = gl.getUniformLocation(shaderProgramObject, "u_la");
    ld_uniform = gl.getUniformLocation(shaderProgramObject, "u_ld");
    ls_uniform = gl.getUniformLocation(shaderProgramObject, "u_ls");

    ka_uniform = gl.getUniformLocation(shaderProgramObject, "u_ka");
    kd_uniform = gl.getUniformLocation(shaderProgramObject, "u_kd");
    ks_uniform = gl.getUniformLocation(shaderProgramObject, "u_ks");

    light_position_uniform = gl.getUniformLocation(shaderProgramObject, "u_light_position");
    material_shininess_uniform = gl.getUniformLocation(shaderProgramObject, "u_material_shininess");

    // *** vertices, colors, shader attribs, vbo, vao initializations ***

    var squareVertices = new Float32Array([
        1.0,1.0,0.0,
        -1.0,1.0,0.0,
        -1.0,-1.0,0.0,
        1.0,-1.0,0.0
    ]);

    var squareNormal = new Float32Array([
        0.0,0.0,1.0,
        0.0,0.0,1.0,
        0.0,0.0,1.0,
        0.0,0.0,1.0,
    ]);

    // ***************
    // VAO FOR SQUARE
    // ***************
    vao_square = gl.createVertexArray();
    gl.bindVertexArray(vao_square);

    // ************************
    // VBO FOR SQUARE POSITION
    // ************************
    vbo_square_position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo_square_position);
    gl.bufferData(gl.ARRAY_BUFFER,squareVertices,gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_VERTEX,3,gl.FLOAT,false,0,0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_VERTEX);
    gl.bindBuffer(gl.ARRAY_BUFFER,null);

    // ************************
    // VBO FOR SQUARE NORMALS
    // ************************
    vbo_square_normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_square_normal);
    gl.bufferData(gl.ARRAY_BUFFER, squareNormal, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_NORMAL, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_NORMAL);
    gl.bindBuffer(gl.ARRAY_BUFFER,null);

    gl.bindVertexArray(null);

    // enable depth test
    gl.enable(gl.DEPTH_TEST);
    // depth test to perform
    gl.depthFunc(gl.LEQUAL);
    // cull back faces for better performance
    gl.enable(gl.CULL_FACE);

    // set clear color
    gl.clearColor(0.0,0.0,0.0,1.0);

    // initialize projection matrix
    perspectiveProjectionMatrix = mat4.create();

}

function resize(){
    if(bFullscreen == true){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = canvas_origional_width;
        canvas.height = canvas_origional_height;
    }
    
    // set the viewport to match
    gl.viewport(0,0,canvas.width,canvas.height);
    mat4.perspective(perspectiveProjectionMatrix,45.0,parseFloat(canvas.width)/parseFloat(canvas.height),0.1,100.0);
}

function draw(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    gl.useProgram(shaderProgramObject);

    // setting light properties
    gl.uniform3fv(la_uniform, light_ambient);
    gl.uniform3fv(ld_uniform, light_diffuse);
    gl.uniform3fv(ls_uniform, light_specular);
    gl.uniform3fv(ka_uniform, material_ambient);
    gl.uniform3fv(kd_uniform, material_diffuse);
    gl.uniform3fv(ks_uniform, material_specular);
    gl.uniform4fv(light_position_uniform, light_position);
    gl.uniform1f(material_shininess_uniform, material_shininess);

    // SQAURE BLOCK
    var modelMatrix = mat4.create();
    var viewMatrix = mat4.create();
    
    mat4.translate(modelMatrix,modelMatrix,[0.0,0.0,-5.0]);

    gl.uniformMatrix4fv(modelMatrixUniform,false,modelMatrix);
    gl.uniformMatrix4fv(viewMatrixUniform,false,viewMatrix);
    gl.uniformMatrix4fv(projectionMatrixUniform,false,perspectiveProjectionMatrix);

    gl.bindVertexArray(vao_square);
    gl.drawArrays(gl.TRIANGLE_FAN,0,4);
    gl.bindVertexArray(null);

    gl.useProgram(null);

    // animation loop
    //update();

    requestAnimationFrame(draw,canvas);
}

function update(){
}

function keyDown(event){
    switch(event.keyCode){
        case 70:    // for F or f
            toggleFullscreen();
            break;
    }
}

function mouseDown(event){
}

function consoleLog(message){
    if(logEnabled == 1){
        console.log(message)
    }
}

function uninitialize(){
    if(vao_square)
    {
        gl.deleteVertexArray(vao_square);
        vao_square = null;
    }
    if(vbo_square_position)
    {
        gl.deleteVertexArray(vbo_square_position)
        vbo_square_position = null;
    }
    if(vbo_square_normal)
    {
        gl.deleteVertexArray(vbo_square_normal)
        vbo_square_normal = null;
    }
    if(shaderProgramObject)
    {
        if(fragmentShaderObject)
        {
            gl.detachShader(shaderProgramObject, fragmentShaderObject);
            gl.deleteShader(fragmentShaderObject);
            fragmentShaderObject = null;
        }
        if(vertexShaderObject)
        {
            gl.detachShader(shaderProgramObject, vertexShaderObject)
            gl.deleteShader(vertexShaderObject);
            vertexShaderObject = null;
        }
        gl.deleteProgram(shaderProgramObject);
        shaderProgramObject = null;
    }
}