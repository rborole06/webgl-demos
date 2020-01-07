
// Fog calculation by linear computation

// global variables
var canvas = null;
var gl = null;
var bFullscreen = false;
var canvas_origional_width;
var canvas_origional_height;

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

var vao_cube;
var vbo_vertices, vbo_color;

var model_matrix_uniform, view_matrix_uniform, projection_matrix_uniform;
var fog_color_uniform, eye_uniform, fog_factor_uniform;

var eye = new Float32Array([0.0, 0.0, 0.0]);
var center = new Float32Array([0.0, 0.0, 0.0]);
var up = new Float32Array([0.0, 1.0, 0.0]);

var fog_color = new Float32Array([0.8, 0.9, 1.0]);
var fog_factor = 0.5;

var angle = 0.0;
var speed = 0.01;

// JQuery UI Slider required initializations
var min = 0;        // minimum value of slider
var max = 1.0;      // maximum value of slider
var step = 0.01;    // how much to increase slider for every mouse move

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
function main() {
    // get canvas element
    canvas = document.getElementById("AMC");
    if(!canvas)
        console.log("Obtaining canvas failed\n");
    else
        console.log("Obtaining canvas succeded\n");

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

function toggleFullscreen() {
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

function init() {

    // get webgl 2.0 context
    gl = canvas.getContext("webgl2");
    if(gl==null){
        console.log("Failed to get rendering context for webgl");
        return;
    }
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    
    // VERTEX SHADER
    var vertexShaderSourceCode =
    "#version 300 es"+
    "\n"+
    "in vec4 vPosition;"+
    "in vec4 vColor;"+
    "uniform mat4 u_model_matrix;"+
    "uniform mat4 u_view_matrix;"+
    "uniform mat4 u_projection_matrix;"+
    "uniform vec3 u_eye;"+	// The eye point(world coordinates)
    "out vec4 out_color;"+
    "void main(void)"+
    "{"+
    // generally, the multiplication order must be u_projection_matrix * u_view_matrix * u_model_matrix
    // but, below it is different as u_projection_matrix * u_model_matrix * u_view_matrix
    // because we are using lookat in our application and that's why view matrix should be multiplied with vertex coordinates first
    "gl_Position = u_projection_matrix * u_model_matrix * u_view_matrix * vPosition;"+
    "out_color = vColor;"+
    "}";

    vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);
    if(gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) == false)
    {
        var error = gl.getShaderInfoLog(vertexShaderObject);
        if(error.length > 0)
        {
            alert("Verex Shader compilation error - "+error);
            uninitialize();
        }
    }

    // FRAGMENT SHADER
    var fragmentShaderSourceCode = 
    "#version 300 es"+
    "\n"+
    "precision highp float;"+
    "in vec4 out_color;"+
    "uniform float u_fog_factor;"+
    "uniform vec3 u_fog_color;"+	// Color of fog
    "out vec4 FragColor;"+
    "void main(void)"+
    "{"+

    // mix function mixes the first 2 values
    // When third value is 0, mix return first value
    // and when it is 1, mix return second value
    // and when it is between 0 and 1, mix return percentage of both colors    
    // NOTE - You can implement mix yourself as - x*(1-z)+y*z
    // where x is first parameter, y is second and z is third
    "vec3 color = mix(u_fog_color, vec3(out_color), u_fog_factor);"+

    "FragColor = vec4(color, out_color.a);"+
    "}";

    fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);
    if(gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) == false)
    {
        var error = gl.getShaderInfoLog(fragmentShaderObject);
        if(error.length > 0)
        {
            alert("Fragment Shader compilation error - "+error);
            uninitialize();
        }
    }

    // LINK PROGRAM
    shaderProgramObject = gl.createProgram();
    gl.attachShader(shaderProgramObject, vertexShaderObject);
    gl.attachShader(shaderProgramObject, fragmentShaderObject);

    // pre link binding of shader program object with vertex shader attribute
    gl.bindAttribLocation(shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_VERTEX, "vPosition");
    // pre link binding of shader program object with color shader attribute
    gl.bindAttribLocation(shaderProgramObject, WebGLMacros.VDG_ATTRIBUTE_COLOR, "vColor");
    // link program
    gl.linkProgram(shaderProgramObject);
    if(!gl.getProgramParameter(shaderProgramObject, gl.LINK_STATUS))
    {
        var error = gl.getProgramInfoLog(shaderProgramObject);
        if(error.length>0)
        {
            alert("Link Program error - "+error);
            uninitialize();
        }
    }

    // get model matrix uniform location
    model_matrix_uniform = gl.getUniformLocation(shaderProgramObject, "u_model_matrix");
    // get view matrix uniform location
    view_matrix_uniform = gl.getUniformLocation(shaderProgramObject, "u_view_matrix");
    // get projection matrix uniform location
    projection_matrix_uniform = gl.getUniformLocation(shaderProgramObject, "u_projection_matrix");
    // get fog color uniform
    fog_color_uniform = gl.getUniformLocation(shaderProgramObject, "u_fog_color");
    // get eye point uniform location
    eye_uniform = gl.getUniformLocation(shaderProgramObject, "u_eye");
    // get fog factor uniform location
    fog_factor_uniform = gl.getUniformLocation(shaderProgramObject, "u_fog_factor")

    var cube_vertices = new Float32Array([
        // FRONT FACE
        1.0,1.0,1.0,
        -1.0,1.0,1.0,
        -1.0,-1.0,1.0,
        1.0,-1.0,1.0,
       
        // RIGHT FACE
        1.0,1.0,-1.0,
        1.0,1.0,1.0,
        1.0,-1.0,1.0,
        1.0,-1.0,-1.0,
        
        // BACK FACE
        1.0,-1.0,-1.0,
        -1.0,-1.0,-1.0,
        -1.0,1.0,-1.0,
        1.0,1.0,-1.0,
        
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
        1.0,-1.0,1.0,
        -1.0,-1.0,1.0,
        -1.0,-1.0,-1.0,
        1.0,-1.0,-1.0
    ]);

    var cube_color = new Float32Array([
        // FRONT FACE
        1.0,0.0,0.0,
        1.0,0.0,0.0,
        1.0,0.0,0.0,
        1.0,0.0,0.0,
       
        // RIGHT FACE
        1.0,0.0,1.0,
        1.0,0.0,1.0,
        1.0,0.0,1.0,
        1.0,0.0,1.0,
        
        // BACK FACE
        0.0,1.0,1.0,
        0.0,1.0,1.0,
        0.0,1.0,1.0,
        0.0,1.0,1.0,
        
        // LEFT FACE
        1.0,1.0,0.0,
        1.0,1.0,0.0,
        1.0,1.0,0.0,
        1.0,1.0,0.0,
        
        // TOP FACE
        0.0,0.0,1.0,
        0.0,0.0,1.0,
        0.0,0.0,1.0,
        0.0,0.0,1.0,

        // BOTTOM FACE
        0.0,1.0,0.0,
        0.0,1.0,0.0,
        0.0,1.0,0.0,
        0.0,1.0,0.0
    ]);

    // create vao for cube
    vao_cube = gl.createVertexArray();
    // bind vao for cube
    gl.bindVertexArray(vao_cube);
    // create vbo for cube vertices
    vbo_vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_vertices);
    gl.bufferData(gl.ARRAY_BUFFER, cube_vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_VERTEX, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_VERTEX);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // create vbo for cube_ color
    vbo_color = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_color);
    gl.bufferData(gl.ARRAY_BUFFER, cube_color, gl.STATIC_DRAW);
    gl.vertexAttribPointer(WebGLMacros.VDG_ATTRIBUTE_COLOR, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(WebGLMacros.VDG_ATTRIBUTE_COLOR);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    // unbind vao
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // set clear color
    gl.clearColor(fog_color[0], fog_color[1], fog_color[2], 1.0);

    // initialize projection matrix
    perspectiveProjectionMatrix = mat4.create();
}

function resize() {
    if(bFullscreen == true){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = canvas_origional_width;
        canvas.height = canvas_origional_height;
    }
    
    // set the viewport to match
    gl.viewport(0,0,canvas.width,canvas.height);
    // set projection
    mat4.perspective(perspectiveProjectionMatrix, 45.0, parseFloat(canvas.width)/parseFloat(canvas.height), 0.1, 100.0);
}

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // bind shader program object
    gl.useProgram(shaderProgramObject);

    // create transformation, view and projection matrices
    var model_matrix = mat4.create();
    var scale_matrix = mat4.create();
    var view_matrix = mat4.create();

    // set view matrix
    mat4.lookAt(view_matrix, eye, center, up);
    // translate object
    mat4.translate(model_matrix, model_matrix, [0, 0, -3.0]);
    // rotate object around x, y and z axis randomly
    mat4.rotateX(model_matrix, model_matrix, angle);
    mat4.rotateY(model_matrix, model_matrix, angle);
    mat4.rotateZ(model_matrix, model_matrix, angle);
    // scale object
    mat4.scale(scale_matrix, scale_matrix, [0.75, 0.75, 0.75]);
    // multiply model and scale matrix
    mat4.multiply(model_matrix, model_matrix, scale_matrix);
    // send model matrix uniform value
    gl.uniformMatrix4fv(model_matrix_uniform, false, model_matrix);
    // send view matrix uniform value
    gl.uniformMatrix4fv(view_matrix_uniform, false, view_matrix);
    // send projection matrix uniform value
    gl.uniformMatrix4fv(projection_matrix_uniform, false, perspectiveProjectionMatrix);
    // pass fog color
    gl.uniform3fv(fog_color_uniform, fog_color);
    // pass eye point of view
    gl.uniform3fv(eye_uniform, eye);
    // pass fog factor
    gl.uniform1f(fog_factor_uniform, fog_factor)

    // draw cube
    gl.bindVertexArray(vao_cube);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.drawArrays(gl.TRIANGLE_FAN, 4, 4);
    gl.drawArrays(gl.TRIANGLE_FAN, 8, 4);
    gl.drawArrays(gl.TRIANGLE_FAN, 12, 4);
    gl.drawArrays(gl.TRIANGLE_FAN, 16, 4);
    gl.drawArrays(gl.TRIANGLE_FAN, 20, 4);
    gl.bindVertexArray(null);

    // unbind shader program object
    gl.useProgram(null);

    // update necessary values
    update();

    // animation loop
    requestAnimationFrame(draw,canvas);
}

function update() {
    angle = angle + speed;
    if(angle > 360)
        angle = 0.0;
}

function keyDown(event) {
    switch(event.keyCode){
        case 70:    // for F or f
            //toggleFullscreen();
            break;
    }
}

function mouseDown(event) {
}

function uninitialize() {
	if(vao_cube)
		vao_cube = '';

	if(vbo_vertices)
		vbo_vertices = '';

	if(vbo_color)
		vbo_color = '';

    if(vertexShaderObject)
    {
        vertexShaderObject = '';
        vertexShaderSourceCode = '';
    }

    if(fragmentShaderObject)
    {
    	fragmentShaderObject = '';
    	fragmentShaderSourceCode = '';
    }

    if(shaderProgramObject)
    	shaderProgramObject = '';
}
