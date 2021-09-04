
export function CreateCubeGeometry(Min=-1,Max=1)
{
	let PositionData = [];
	let UvData = [];
	
	let AddTriangle = function(a,b,c)
	{
		PositionData.push( ...a.slice(0,3) );
		PositionData.push( ...b.slice(0,3) );
		PositionData.push( ...c.slice(0,3) );
		UvData.push( ...a.slice(3,5) );
		UvData.push( ...b.slice(3,5) );
		UvData.push( ...c.slice(3,5) );
	}
	
	//	top left near bottom right far
	let tln = [Min,Min,Min,		0,0];
	let trn = [Max,Min,Min,		1,0];
	let brn = [Max,Max,Min,		1,1];
	let bln = [Min,Max,Min,		0,1];
	let tlf = [Min,Min,Max,		0,0];
	let trf = [Max,Min,Max,		1,0];
	let brf = [Max,Max,Max,		1,1];
	let blf = [Min,Max,Max,		0,1];
	
	
	//	near
	AddTriangle( tln, trn, brn );
	AddTriangle( brn, bln, tln );
	//	far
	AddTriangle( trf, tlf, blf );
	AddTriangle( blf, brf, trf );
	
	//	top
	AddTriangle( tln, tlf, trf );
	AddTriangle( trf, trn, tln );
	//	bottom
	AddTriangle( bln, blf, brf );
	AddTriangle( brf, brn, bln );
	
	//	left
	AddTriangle( tlf, tln, bln );
	AddTriangle( bln, blf, tlf );
	//	right
	AddTriangle( trn, trf, brf );
	AddTriangle( brf, brn, trn );
	
	const Attributes = {};
	Attributes.LocalPosition = {};
	Attributes.LocalPosition.Size = 3;
	Attributes.LocalPosition.Data = new Float32Array(PositionData);

	Attributes.LocalUv = {};
	Attributes.LocalUv.Size = 2;
	Attributes.LocalUv.Data = new Float32Array(UvData);
	
	return Attributes;
}

class Shader_t
{
	constructor(VertSource,FragSource,gl)
	{
		this.gl = gl;
		const FragShader = this.CompileShader( gl, gl.FRAGMENT_SHADER, FragSource );
		const VertShader = this.CompileShader( gl, gl.VERTEX_SHADER, VertSource );
		let Program = this.Program = gl.createProgram();
		gl.attachShader( Program, VertShader );
		gl.attachShader( Program, FragShader );
		gl.linkProgram( Program );
		
		let LinkStatus = gl.getProgramParameter( Program, gl.LINK_STATUS );
		if ( !LinkStatus )
		{
			//	gr: list cases when no error "" occurs here;
			//	- too many varyings > MAX_VARYING_VECTORS
			const Error = gl.getProgramInfoLog(Program);
			throw `Failed to link shaders; ${Error}`;
		}
	}
	
	CompileShader(gl,Type,Source)
	{
		const Shader = gl.createShader(Type);
		gl.shaderSource( Shader, Source );
		gl.compileShader( Shader );
		const CompileStatus = gl.getShaderParameter( Shader, gl.COMPILE_STATUS);
		if ( !CompileStatus )
		{
			let Error = gl.getShaderInfoLog(Shader);
			throw `Failed to compile shader: ${Error}`;
		}
		return Shader;
	}
	
	GetUniformMetas()
	{
		if ( this.UniformMetaCache )
			return this.UniformMetaCache;
	
		const gl = this.gl;
	
		//	iterate and cache!
		this.UniformMetaCache = {};
		let UniformCount = gl.getProgramParameter( this.Program, gl.ACTIVE_UNIFORMS );
		for ( let i=0;	i<UniformCount;	i++ )
		{
			let UniformMeta = gl.getActiveUniform( this.Program, i );
			UniformMeta.ElementCount = UniformMeta.size;
			UniformMeta.ElementSize = undefined;
			//	match name even if it's an array
			//	todo: struct support
			let UniformName = UniformMeta.name.split('[')[0];
			//	note: uniform consists of structs, Array[Length] etc
			
			UniformMeta.Location = gl.getUniformLocation( this.Program, UniformMeta.name );
			switch( UniformMeta.type )
			{
				case gl.SAMPLER_2D:	//	samplers' value is the texture index
				case gl.INT:
				case gl.UNSIGNED_INT:
				case gl.BOOL:
					UniformMeta.ElementSize = 1;
					UniformMeta.SetValues = function(v)	{	gl.uniform1iv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT:
					UniformMeta.ElementSize = 1;
					UniformMeta.SetValues = function(v)	{	gl.uniform1fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_VEC2:
					UniformMeta.ElementSize = 2;
					UniformMeta.SetValues = function(v)	{	gl.uniform2fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_VEC3:
					UniformMeta.ElementSize = 3;
					UniformMeta.SetValues = function(v)	{	gl.uniform3fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_VEC4:
					UniformMeta.ElementSize = 4;
					UniformMeta.SetValues = function(v)	{	gl.uniform4fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_MAT2:
					UniformMeta.ElementSize = 2*2;
					UniformMeta.SetValues = function(v)	{	const Transpose = false;	gl.uniformMatrix2fv( UniformMeta.Location, Transpose, v );	};
					break;
				case gl.FLOAT_MAT3:
					UniformMeta.ElementSize = 3*3;
					UniformMeta.SetValues = function(v)	{	const Transpose = false;	gl.uniformMatrix3fv( UniformMeta.Location, Transpose, v );	};
					break;
				case gl.FLOAT_MAT4:
					UniformMeta.ElementSize = 4*4;
					UniformMeta.SetValues = function(v)	{	const Transpose = false;	gl.uniformMatrix4fv( UniformMeta.Location, Transpose, v );	};
					break;

				default:
					UniformMeta.SetValues = function(v)	{	throw "Unhandled type " + UniformMeta.type + " on " + UniformName;	};
					break;
			}
			
			this.UniformMetaCache[UniformName] = UniformMeta;
		}
		return this.UniformMetaCache;
	}

	GetUniformMeta(MatchUniformName)
	{
		const Metas = this.GetUniformMetas();
		if ( !Metas.hasOwnProperty(MatchUniformName) )
		{
			//throw "No uniform named " + MatchUniformName;
			//Pop.Debug("No uniform named " + MatchUniformName);
		}
		return Metas[MatchUniformName];
	}
	
	SetUniform(Uniform,Value)
	{
		const UniformMeta = this.GetUniformMeta(Uniform);
		if ( !UniformMeta )
			return;
		if( Array.isArray(Value) )					this.SetUniformArray( Uniform, UniformMeta, Value );
		else if( Value instanceof Float32Array )	this.SetUniformArray( Uniform, UniformMeta, Value );
		//else if ( Value instanceof PopImage )		this.SetUniformTexture( Uniform, UniformMeta, Value, this.Context.AllocTextureIndex() );
		else if ( typeof Value === 'number' )		this.SetUniformNumber( Uniform, UniformMeta, Value );
		else if ( typeof Value === 'boolean' )		this.SetUniformNumber( Uniform, UniformMeta, Value );
		else
		{
			console.log(typeof Value);
			console.log(Value);
			throw "Failed to set uniform " +Uniform + " to " + ( typeof Value );
		}
	}
	
	SetUniformNumber(Uniform,UniformMeta,Value)
	{
		//	these are hard to track down and pretty rare anyone would want a nan
		if ( isNaN(Value) )
			throw "Setting NaN on Uniform " + Uniform.Name;
		UniformMeta.SetValues( [Value] );
	}
	
	SetUniformArray(UniformName,UniformMeta,Values)
	{
		const ExpectedValueCount = UniformMeta.ElementSize * UniformMeta.ElementCount;
		
		//	all aligned
		if ( Values.length == ExpectedValueCount )
		{
			UniformMeta.SetValues( Values );
			return;
		}
		//	providing MORE values, do a quick slice. Should we warn about this?
		if ( Values.length >= ExpectedValueCount )
		{
			const ValuesCut = Values.slice(0,ExpectedValueCount);
			UniformMeta.SetValues( ValuesCut );
			return;
		}
		
		//Pop.Debug("SetUniformArray("+UniformName+") slow path");
		
		//	note: uniform iv may need to be Int32Array;
		//	https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniform
		//	enumerate the array
		let ValuesExpanded = [];
		let EnumValue = function(v)
		{
			if ( Array.isArray(v) )
				ValuesExpanded.push(...v);
			else if ( typeof v == "object" )
				v.Enum( function(v)	{	ValuesExpanded.push(v);	} );
			else
				ValuesExpanded.push(v);
		};
		Values.forEach( EnumValue );
		
		//	check array size (allow less, but throw on overflow)
		//	error if array is empty
		while ( ValuesExpanded.length < ExpectedValueCount )
			ValuesExpanded.push(0);
		/*
		 if ( ValuesExpanded.length > UniformMeta.size )
		 throw "Trying to put array of " + ValuesExpanded.length + " values into uniform " + UniformName + "[" + UniformMeta.size + "] ";
		 */
		UniformMeta.SetValues( ValuesExpanded );
	}
}

//	gr: stripped down geo which is positions (.Name .Data .Size) only
class Geometry_t
{
	//	geometry binding is per shader
	constructor(TrianglePositions,Shader,gl)
	{
		const VertexBuffer = this.CreateVertexBuffer(TrianglePositions,gl);
		this.Vao = gl.createVertexArray();
		gl.bindVertexArray( this.Vao );
		gl.bindBuffer( gl.ARRAY_BUFFER, VertexBuffer );
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
		
		{
			let Location = gl.getAttribLocation( Shader.Program, TrianglePositions.Name );
			if ( Location == -1 )
				throw `Shader doesn't use geo attrib ${TrianglePositions.Name}`;
			
			let Type = gl.FLOAT;
			let Normalised = false;
			
			let Size = TrianglePositions.Size;
			let StrideBytes = 0;
			let OffsetBytes = 0;
			gl.vertexAttribPointer( Location, Size, Type, Normalised, StrideBytes, OffsetBytes );
			gl.enableVertexAttribArray( Location );
		}
	}
	
	CreateVertexBuffer(TrianglePositions,gl)
	{
		const VertexBuffer = gl.createBuffer();
		this.PrimitiveType = gl.TRIANGLES;
		const FirstAttrib = TrianglePositions;
		this.IndexCount = (FirstAttrib.Data.length / FirstAttrib.Size);
		if ( this.IndexCount % 3 != 0 )
			throw `Triangle index count ${this.IndexCount} not divisible by 3`;
		
		gl.bindBuffer( gl.ARRAY_BUFFER, VertexBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, TrianglePositions.Data, gl.STATIC_DRAW );
		return VertexBuffer;
	}


	Bind(gl)
	{
		gl.bindVertexArray( this.Vao );
	}
}

export default class GlContext_t
{
	constructor(Canvas)
	{
		this.Canvas = Canvas;
		this.Context = Canvas.getContext('webgl2');	//	if webgl we need to enable VAO
		this.InitFrame();
	}
	
	async WaitForFrame()
	{
		let p = {};
		p.Promise = new Promise( (Resolve,Reject) => { p.Resolve = Resolve; p.Reject = Reject; } );
		window.requestAnimationFrame( TimeMs => p.Resolve(TimeMs/1000) );
		return p.Promise;
	}

	InitFrame()
	{
		const gl = this.Context;
		//gl.viewport( ...Viewport );
		//gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		
		gl.disable(gl.CULL_FACE);
		gl.disable(gl.BLEND);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.SCISSOR_TEST);
		gl.disable(gl.SCISSOR_TEST);
		//	to make blending work well, don't reject things on same plane
		gl.depthFunc(gl.LEQUAL);
		
	}
	
	GetCanvasDomRect(Element)
	{
		//	first see if WE have our own rect
		const SelfRect = Element.getBoundingClientRect();
		if ( SelfRect.height )
		{
			return [SelfRect.x,SelfRect.y,SelfRect.width,SelfRect.height];
		}
		
		const ParentElement = Element.parentElement;
		if ( ParentElement )
		{
			//	try and go as big as parent
			//	values may be zero, so then go for window (erk!)
			const ParentSize = [ParentElement.clientWidth,ParentElement.clientHeight];
			const ParentInnerSize = [ParentElement.innerWidth,ParentElement.innerHeight];
			const WindowInnerSize = [window.innerWidth,window.innerHeight];

			let Width = ParentSize[0];
			let Height = ParentSize[1];
			if (!Width)
				Width = WindowInnerSize[0];
			if (!Height)
				Height = WindowInnerSize[1];
			Rect = [0,0,Width,Height];
			Pop.Debug("SetCanvasSize defaulting to ",Rect,"ParentSize=" + ParentSize,"ParentInnerSize=" + ParentInnerSize,"WindowInnerSize=" + WindowInnerSize);
			return Rect;
		}
		
		throw `Don't know how to get canvas size`;
	}
	
	UpdateCanvasSize()
	{
		let Rect = this.GetCanvasDomRect(this.Canvas);
		this.Canvas.width = Rect[2];
		this.Canvas.height = Rect[3];
	}
	
	Clear(rgba)
	{
		//this.UpdateCanvasSize();
		const gl = this.Context;
		gl.clearColor( ...rgba );
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
	
	CreateCubeGeo(Shader)
	{
		const Cube = CreateCubeGeometry(0,1);
		Cube.LocalPosition.Name = 'LocalPosition';
		return new Geometry_t( Cube.LocalPosition, Shader, this.Context );
	}
	
	CreateShader(VertSource,FragSource)
	{
		return new Shader_t( VertSource, FragSource, this.Context );
	}
	
	Draw(Geo,Shader,Uniforms)
	{
		//	bind shader
		//	bind geo
		//	set uniforms
		//	draw triangles
		const gl = this.Context;
		gl.useProgram( Shader.Program );
		gl.bindVertexArray( Geo.Vao );
		
		Object.entries(Uniforms).forEach( KeyValue => Shader.SetUniform(...KeyValue) );
		
		gl.drawArrays( Geo.PrimitiveType, 0, Geo.IndexCount );
	}
	
}
