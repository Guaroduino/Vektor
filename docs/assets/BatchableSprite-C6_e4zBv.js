import{S as Y,c as nt,d as q,f as K,g as ot,u as at,h as st,i as k,G as ut,j as lt,k as D,l as A,w as ct,m as ht,E as ft}from"./index-DzSnd3Eh.js";const J=class V extends Y{constructor(t){t={...V.defaultOptions,...t},super(t),this.enabled=!0,this._state=nt.for2d(),this.blendMode=t.blendMode,this.padding=t.padding,typeof t.antialias=="boolean"?this.antialias=t.antialias?"on":"off":this.antialias=t.antialias,this.resolution=t.resolution,this.blendRequired=t.blendRequired,this.clipToViewport=t.clipToViewport,this.addResource("uTexture",0,1)}apply(t,e,r,n){t.applyFilter(this,e,r,n)}get blendMode(){return this._state.blendMode}set blendMode(t){this._state.blendMode=t}static from(t){const{gpu:e,gl:r,...n}=t;let a,u;return e&&(a=q.from(e)),r&&(u=K.from(r)),new V({gpuProgram:a,glProgram:u,...n})}};J.defaultOptions={blendMode:"normal",resolution:1,padding:0,antialias:"off",blendRequired:!1,clipToViewport:!0};let Jt=J;class R{constructor(t){typeof t=="number"?this.rawBinaryData=new ArrayBuffer(t):t instanceof Uint8Array?this.rawBinaryData=t.buffer:this.rawBinaryData=t,this.uint32View=new Uint32Array(this.rawBinaryData),this.float32View=new Float32Array(this.rawBinaryData),this.size=this.rawBinaryData.byteLength}get int8View(){return this._int8View||(this._int8View=new Int8Array(this.rawBinaryData)),this._int8View}get uint8View(){return this._uint8View||(this._uint8View=new Uint8Array(this.rawBinaryData)),this._uint8View}get int16View(){return this._int16View||(this._int16View=new Int16Array(this.rawBinaryData)),this._int16View}get int32View(){return this._int32View||(this._int32View=new Int32Array(this.rawBinaryData)),this._int32View}get float64View(){return this._float64Array||(this._float64Array=new Float64Array(this.rawBinaryData)),this._float64Array}get bigUint64View(){return this._bigUint64Array||(this._bigUint64Array=new BigUint64Array(this.rawBinaryData)),this._bigUint64Array}view(t){return this[`${t}View`]}destroy(){this.rawBinaryData=null,this._int8View=null,this._uint8View=null,this._int16View=null,this.uint16View=null,this._int32View=null,this.uint32View=null,this.float32View=null}static sizeOf(t){switch(t){case"int8":case"uint8":return 1;case"int16":case"uint16":return 2;case"int32":case"uint32":case"float32":return 4;default:throw new Error(`${t} isn't a valid view type`)}}}function $(i,t){const e=i.byteLength/8|0,r=new Float64Array(i,0,e);new Float64Array(t,0,e).set(r);const a=i.byteLength-e*8;if(a>0){const u=new Uint8Array(i,e*8,a);new Uint8Array(t,e*8,a).set(u)}}const dt=["precision mediump float;","void main(void){","float test = 0.1;","%forloop%","gl_FragColor = vec4(0.0);","}"].join(`
`);function mt(i){let t="";for(let e=0;e<i;++e)e>0&&(t+=`
else `),e<i-1&&(t+=`if(test == ${e}.0){}`);return t}function xt(i,t){if(i===0)throw new Error("Invalid value of `0` passed to `checkMaxIfStatementsInShader`");const e=t.createShader(t.FRAGMENT_SHADER);try{for(;;){const r=dt.replace(/%forloop%/gi,mt(i));if(t.shaderSource(e,r),t.compileShader(e),!t.getShaderParameter(e,t.COMPILE_STATUS))i=i/2|0;else break}}finally{t.deleteShader(e)}return i}let w=null;function pt(){if(w)return w;const i=ot();return w=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),w=xt(w,i),i.getExtension("WEBGL_lose_context")?.loseContext(),w}class vt{constructor(){this.ids=Object.create(null),this.textures=[],this.count=0}clear(){for(let t=0;t<this.count;t++){const e=this.textures[t];this.textures[t]=null,this.ids[e.uid]=null}this.count=0}}class gt{constructor(){this.renderPipeId="batch",this.action="startBatch",this.start=0,this.size=0,this.textures=new vt,this.blendMode="normal",this.topology="triangle-strip",this.canBundle=!0}destroy(){this.textures=null,this.gpuBindGroup=null,this.bindGroup=null,this.batcher=null}}const I=[];let U=0;ut.register({clear:()=>{if(I.length>0)for(const i of I)i&&i.destroy();I.length=0,U=0}});function E(){return U>0?I[--U]:new gt}function F(i){I[U++]=i}let B=0;const O=class Z{constructor(t){this.uid=at("batcher"),this.dirty=!0,this.batchIndex=0,this.batches=[],this._elements=[],t={...Z.defaultOptions,...t},t.maxTextures||(st("v8.8.0","maxTextures is a required option for Batcher now, please pass it in the options"),t.maxTextures=pt());const{maxTextures:e,attributesInitialSize:r,indicesInitialSize:n}=t;this.attributeBuffer=new R(r*4),this.indexBuffer=new Uint16Array(n),this.maxTextures=e}begin(){this.elementSize=0,this.elementStart=0,this.indexSize=0,this.attributeSize=0;for(let t=0;t<this.batchIndex;t++)F(this.batches[t]);this.batchIndex=0,this._batchIndexStart=0,this._batchIndexSize=0,this.dirty=!0}add(t){this._elements[this.elementSize++]=t,t._indexStart=this.indexSize,t._attributeStart=this.attributeSize,t._batcher=this,this.indexSize+=t.indexSize,this.attributeSize+=t.attributeSize*this.vertexSize}checkAndUpdateTexture(t,e){const r=t._batch.textures.ids[e._source.uid];return!r&&r!==0?!1:(t._textureId=r,t.texture=e,!0)}updateElement(t){this.dirty=!0;const e=this.attributeBuffer;t.packAsQuad?this.packQuadAttributes(t,e.float32View,e.uint32View,t._attributeStart,t._textureId):this.packAttributes(t,e.float32View,e.uint32View,t._attributeStart,t._textureId)}break(t){const e=this._elements;if(!e[this.elementStart])return;let r=E(),n=r.textures;n.clear();const a=e[this.elementStart];let u=k(a.blendMode,a.texture._source),s=a.topology;this.attributeSize*4>this.attributeBuffer.size&&this._resizeAttributeBuffer(this.attributeSize*4),this.indexSize>this.indexBuffer.length&&this._resizeIndexBuffer(this.indexSize);const l=this.attributeBuffer.float32View,c=this.attributeBuffer.uint32View,v=this.indexBuffer;let f=this._batchIndexSize,d=this._batchIndexStart,g="startBatch";const b=this.maxTextures;for(let x=this.elementStart;x<this.elementSize;++x){const o=e[x];e[x]=null;const m=o.texture._source,h=k(o.blendMode,m),p=u!==h||s!==o.topology;if(m._batchTick===B&&!p){o._textureId=m._textureBindLocation,f+=o.indexSize,o.packAsQuad?(this.packQuadAttributes(o,l,c,o._attributeStart,o._textureId),this.packQuadIndex(v,o._indexStart,o._attributeStart/this.vertexSize)):(this.packAttributes(o,l,c,o._attributeStart,o._textureId),this.packIndex(o,v,o._indexStart,o._attributeStart/this.vertexSize)),o._batch=r;continue}m._batchTick=B,(n.count>=b||p)&&(this._finishBatch(r,d,f-d,n,u,s,t,g),g="renderBatch",d=f,u=h,s=o.topology,r=E(),n=r.textures,n.clear(),++B),o._textureId=m._textureBindLocation=n.count,n.ids[m.uid]=n.count,n.textures[n.count++]=m,o._batch=r,f+=o.indexSize,o.packAsQuad?(this.packQuadAttributes(o,l,c,o._attributeStart,o._textureId),this.packQuadIndex(v,o._indexStart,o._attributeStart/this.vertexSize)):(this.packAttributes(o,l,c,o._attributeStart,o._textureId),this.packIndex(o,v,o._indexStart,o._attributeStart/this.vertexSize))}n.count>0&&(this._finishBatch(r,d,f-d,n,u,s,t,g),d=f,++B),this.elementStart=this.elementSize,this._batchIndexStart=d,this._batchIndexSize=f}_finishBatch(t,e,r,n,a,u,s,l){t.gpuBindGroup=null,t.bindGroup=null,t.action=l,t.batcher=this,t.textures=n,t.blendMode=a,t.topology=u,t.start=e,t.size=r,++B,this.batches[this.batchIndex++]=t,s.add(t)}finish(t){this.break(t)}ensureAttributeBuffer(t){t*4<=this.attributeBuffer.size||this._resizeAttributeBuffer(t*4)}ensureIndexBuffer(t){t<=this.indexBuffer.length||this._resizeIndexBuffer(t)}_resizeAttributeBuffer(t){const e=Math.max(t,this.attributeBuffer.size*2),r=new R(e);$(this.attributeBuffer.rawBinaryData,r.rawBinaryData),this.attributeBuffer=r}_resizeIndexBuffer(t){const e=this.indexBuffer;let r=Math.max(t,e.length*1.5);r+=r%2;const n=r>65535?new Uint32Array(r):new Uint16Array(r);if(n.BYTES_PER_ELEMENT!==e.BYTES_PER_ELEMENT)for(let a=0;a<e.length;a++)n[a]=e[a];else $(e.buffer,n.buffer);this.indexBuffer=n}packQuadIndex(t,e,r){t[e]=r+0,t[e+1]=r+1,t[e+2]=r+2,t[e+3]=r+0,t[e+4]=r+2,t[e+5]=r+3}packIndex(t,e,r,n){const a=t.indices,u=t.indexSize,s=t.indexOffset,l=t.attributeOffset;for(let c=0;c<u;c++)e[r++]=n+a[c+s]-l}destroy(){if(this.batches!==null){for(let t=0;t<this.batches.length;t++)F(this.batches[t]);this.batches=null;for(let t=0;t<this._elements.length;t++)this._elements[t]&&(this._elements[t]._batch=null);this._elements=null,this.indexBuffer=null,this.attributeBuffer.destroy(),this.attributeBuffer=null}}};O.defaultOptions={maxTextures:null,attributesInitialSize:4,indicesInitialSize:6};let bt=O;const St=new Float32Array(1),_t=new Uint32Array(1);class yt extends lt{constructor(){const e=new D({data:St,label:"attribute-batch-buffer",usage:A.VERTEX|A.COPY_DST,shrinkToFit:!1}),r=new D({data:_t,label:"index-batch-buffer",usage:A.INDEX|A.COPY_DST,shrinkToFit:!1}),n=24;super({attributes:{aPosition:{buffer:e,format:"float32x2",stride:n,offset:0},aUV:{buffer:e,format:"float32x2",stride:n,offset:8},aColor:{buffer:e,format:"unorm8x4",stride:n,offset:16},aTextureIdAndRound:{buffer:e,format:"uint16x2",stride:n,offset:20}},indexBuffer:r})}}function j(i,t,e){if(i)for(const r in i){const n=r.toLocaleLowerCase(),a=t[n];if(a){let u=i[r];r==="header"&&(u=u.replace(/@in\s+[^;]+;\s*/g,"").replace(/@out\s+[^;]+;\s*/g,"")),e&&a.push(`//----${e}----//`),a.push(u)}else ct(`${r} placement hook does not exist in shader`)}}const wt=/\{\{(.*?)\}\}/g;function H(i){const t={};return(i.match(wt)?.map(r=>r.replace(/[{()}]/g,""))??[]).forEach(r=>{t[r]=[]}),t}function L(i,t){let e;const r=/@in\s+([^;]+);/g;for(;(e=r.exec(i))!==null;)t.push(e[1])}function Q(i,t,e=!1){const r=[];L(t,r),i.forEach(s=>{s.header&&L(s.header,r)});const n=r;e&&n.sort();const a=n.map((s,l)=>`       @location(${l}) ${s},`).join(`
`);let u=t.replace(/@in\s+[^;]+;\s*/g,"");return u=u.replace("{{in}}",`
${a}
`),u}function W(i,t){let e;const r=/@out\s+([^;]+);/g;for(;(e=r.exec(i))!==null;)t.push(e[1])}function Bt(i){const e=/\b(\w+)\s*:/g.exec(i);return e?e[1]:""}function It(i){const t=/@.*?\s+/g;return i.replace(t,"")}function At(i,t){const e=[];W(t,e),i.forEach(l=>{l.header&&W(l.header,e)});let r=0;const n=e.sort().map(l=>l.indexOf("builtin")>-1?l:`@location(${r++}) ${l}`).join(`,
`),a=e.sort().map(l=>`       var ${It(l)};`).join(`
`),u=`return VSOutput(
            ${e.sort().map(l=>` ${Bt(l)}`).join(`,
`)});`;let s=t.replace(/@out\s+[^;]+;\s*/g,"");return s=s.replace("{{struct}}",`
${n}
`),s=s.replace("{{start}}",`
${a}
`),s=s.replace("{{return}}",`
${u}
`),s}function N(i,t){let e=i;for(const r in t){const n=t[r];n.join(`
`).length?e=e.replace(`{{${r}}}`,`//-----${r} START-----//
${n.join(`
`)}
//----${r} FINISH----//`):e=e.replace(`{{${r}}}`,"")}return e}const _=Object.create(null),P=new Map;let Ut=0;function Pt({template:i,bits:t}){const e=tt(i,t);if(_[e])return _[e];const{vertex:r,fragment:n}=Tt(i,t);return _[e]=et(r,n,t),_[e]}function Ct({template:i,bits:t}){const e=tt(i,t);return _[e]||(_[e]=et(i.vertex,i.fragment,t)),_[e]}function Tt(i,t){const e=t.map(u=>u.vertex).filter(u=>!!u),r=t.map(u=>u.fragment).filter(u=>!!u);let n=Q(e,i.vertex,!0);n=At(e,n);const a=Q(r,i.fragment,!0);return{vertex:n,fragment:a}}function tt(i,t){return t.map(e=>(P.has(e)||P.set(e,Ut++),P.get(e))).sort((e,r)=>e-r).join("-")+i.vertex+i.fragment}function et(i,t,e){const r=H(i),n=H(t);return e.forEach(a=>{j(a.vertex,r,a.name),j(a.fragment,n,a.name)}),{vertex:N(i,r),fragment:N(t,n)}}const Mt=`
    @in aPosition: vec2<f32>;
    @in aUV: vec2<f32>;

    @out @builtin(position) vPosition: vec4<f32>;
    @out vUV : vec2<f32>;
    @out vColor : vec4<f32>;

    {{header}}

    struct VSOutput {
        {{struct}}
    };

    @vertex
    fn main( {{in}} ) -> VSOutput {

        var worldTransformMatrix = globalUniforms.uWorldTransformMatrix;
        var modelMatrix = mat3x3<f32>(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        var position = aPosition;
        var uv = aUV;

        {{start}}

        vColor = vec4<f32>(1., 1., 1., 1.);

        {{main}}

        vUV = uv;

        var modelViewProjectionMatrix = globalUniforms.uProjectionMatrix * worldTransformMatrix * modelMatrix;

        vPosition =  vec4<f32>((modelViewProjectionMatrix *  vec3<f32>(position, 1.0)).xy, 0.0, 1.0);

        vColor *= globalUniforms.uWorldColorAlpha;

        {{end}}

        {{return}}
    };
`,zt=`
    @in vUV : vec2<f32>;
    @in vColor : vec4<f32>;

    {{header}}

    @fragment
    fn main(
        {{in}}
      ) -> @location(0) vec4<f32> {

        {{start}}

        var outColor:vec4<f32>;

        {{main}}

        var finalColor:vec4<f32> = outColor * vColor;

        {{end}}

        return finalColor;
      };
`,Vt=`
    in vec2 aPosition;
    in vec2 aUV;

    out vec4 vColor;
    out vec2 vUV;

    {{header}}

    void main(void){

        mat3 worldTransformMatrix = uWorldTransformMatrix;
        mat3 modelMatrix = mat3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        vec2 position = aPosition;
        vec2 uv = aUV;

        {{start}}

        vColor = vec4(1.);

        {{main}}

        vUV = uv;

        mat3 modelViewProjectionMatrix = uProjectionMatrix * worldTransformMatrix * modelMatrix;

        gl_Position = vec4((modelViewProjectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);

        vColor *= uWorldColorAlpha;

        {{end}}
    }
`,Gt=`

    in vec4 vColor;
    in vec2 vUV;

    out vec4 finalColor;

    {{header}}

    void main(void) {

        {{start}}

        vec4 outColor;

        {{main}}

        finalColor = outColor * vColor;

        {{end}}
    }
`,kt={name:"global-uniforms-bit",vertex:{header:`
        struct GlobalUniforms {
            uProjectionMatrix:mat3x3<f32>,
            uWorldTransformMatrix:mat3x3<f32>,
            uWorldColorAlpha: vec4<f32>,
            uResolution: vec2<f32>,
        }

        @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
        `}},Dt={name:"global-uniforms-bit",vertex:{header:`
          uniform mat3 uProjectionMatrix;
          uniform mat3 uWorldTransformMatrix;
          uniform vec4 uWorldColorAlpha;
          uniform vec2 uResolution;
        `}};function Rt({bits:i,name:t}){const e=Pt({template:{fragment:zt,vertex:Mt},bits:[kt,...i]});return q.from({name:t,vertex:{source:e.vertex,entryPoint:"main"},fragment:{source:e.fragment,entryPoint:"main"}})}function $t({bits:i,name:t}){return new K({name:t,...Ct({template:{vertex:Vt,fragment:Gt},bits:[Dt,...i]})})}const Et={name:"color-bit",vertex:{header:`
            @in aColor: vec4<f32>;
        `,main:`
            vColor *= vec4<f32>(aColor.rgb * aColor.a, aColor.a);
        `}},Ft={name:"color-bit",vertex:{header:`
            in vec4 aColor;
        `,main:`
            vColor *= vec4(aColor.rgb * aColor.a, aColor.a);
        `}},C={};function jt(i){const t=[];if(i===1)t.push("@group(1) @binding(0) var textureSource1: texture_2d<f32>;"),t.push("@group(1) @binding(1) var textureSampler1: sampler;");else{let e=0;for(let r=0;r<i;r++)t.push(`@group(1) @binding(${e++}) var textureSource${r+1}: texture_2d<f32>;`),t.push(`@group(1) @binding(${e++}) var textureSampler${r+1}: sampler;`)}return t.join(`
`)}function Ht(i){const t=[];if(i===1)t.push("outColor = textureSampleGrad(textureSource1, textureSampler1, vUV, uvDx, uvDy);");else{t.push("switch vTextureId {");for(let e=0;e<i;e++)e===i-1?t.push("  default:{"):t.push(`  case ${e}:{`),t.push(`      outColor = textureSampleGrad(textureSource${e+1}, textureSampler${e+1}, vUV, uvDx, uvDy);`),t.push("      break;}");t.push("}")}return t.join(`
`)}function Lt(i){return C[i]||(C[i]={name:"texture-batch-bit",vertex:{header:`
                @in aTextureIdAndRound: vec2<u32>;
                @out @interpolate(flat) vTextureId : u32;
            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1)
                {
                    vPosition = vec4<f32>(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
                }
            `},fragment:{header:`
                @in @interpolate(flat) vTextureId: u32;

                ${jt(i)}
            `,main:`
                var uvDx = dpdx(vUV);
                var uvDy = dpdy(vUV);

                ${Ht(i)}
            `}}),C[i]}const T={};function Qt(i){const t=[];for(let e=0;e<i;e++)e>0&&t.push("else"),e<i-1&&t.push(`if(vTextureId < ${e}.5)`),t.push("{"),t.push(`	outColor = texture(uTextures[${e}], vUV);`),t.push("}");return t.join(`
`)}function Wt(i){return T[i]||(T[i]={name:"texture-batch-bit",vertex:{header:`
                in vec2 aTextureIdAndRound;
                out float vTextureId;

            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1.)
                {
                    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
                }
            `},fragment:{header:`
                in float vTextureId;

                uniform sampler2D uTextures[${i}];

            `,main:`

                ${Qt(i)}
            `}}),T[i]}const Nt={name:"round-pixels-bit",vertex:{header:`
            fn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>
            {
                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
            }
        `}},Xt={name:"round-pixels-bit",vertex:{header:`
            vec2 roundPixels(vec2 position, vec2 targetSize)
            {
                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
            }
        `}},X={};function Yt(i){let t=X[i];if(t)return t;const e=new Int32Array(i);for(let r=0;r<i;r++)e[r]=r;return t=X[i]=new ht({uTextures:{value:e,type:"i32",size:i}},{isStatic:!0}),t}class qt extends Y{constructor(t){const e=$t({name:"batch",bits:[Ft,Wt(t),Xt]}),r=Rt({name:"batch",bits:[Et,Lt(t),Nt]});super({glProgram:e,gpuProgram:r,resources:{batchSamplers:Yt(t)}})}}let M=null;const rt=class it extends bt{constructor(t){super(t),this.geometry=new yt,this.name=it.extension.name,this.vertexSize=6,M??(M=new qt(t.maxTextures)),this.shader=M}packAttributes(t,e,r,n,a){const u=a<<16|t.roundPixels&65535,s=t.transform,l=s.a,c=s.b,v=s.c,f=s.d,d=s.tx,g=s.ty,{positions:b,uvs:x}=t,o=t.color,S=t.attributeOffset,m=S+t.attributeSize;for(let h=S;h<m;h++){const p=h*2,y=b[p],G=b[p+1];e[n++]=l*y+v*G+d,e[n++]=f*G+c*y+g,e[n++]=x[p],e[n++]=x[p+1],r[n++]=o,r[n++]=u}}packQuadAttributes(t,e,r,n,a){const u=t.texture,s=t.transform,l=s.a,c=s.b,v=s.c,f=s.d,d=s.tx,g=s.ty,b=t.bounds,x=b.maxX,o=b.minX,S=b.maxY,m=b.minY,h=u.uvs,p=t.color,y=a<<16|t.roundPixels&65535;e[n+0]=l*o+v*m+d,e[n+1]=f*m+c*o+g,e[n+2]=h.x0,e[n+3]=h.y0,r[n+4]=p,r[n+5]=y,e[n+6]=l*x+v*m+d,e[n+7]=f*m+c*x+g,e[n+8]=h.x1,e[n+9]=h.y1,r[n+10]=p,r[n+11]=y,e[n+12]=l*x+v*S+d,e[n+13]=f*S+c*x+g,e[n+14]=h.x2,e[n+15]=h.y2,r[n+16]=p,r[n+17]=y,e[n+18]=l*o+v*S+d,e[n+19]=f*S+c*o+g,e[n+20]=h.x3,e[n+21]=h.y3,r[n+22]=p,r[n+23]=y}};rt.extension={type:[ft.Batcher],name:"default"};let Ot=rt;const z={name:"local-uniform-bit",vertex:{header:`

            struct LocalUniforms {
                uTransformMatrix:mat3x3<f32>,
                uColor:vec4<f32>,
                uRound:f32,
            }

            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,main:`
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,end:`
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `}},Zt={...z,vertex:{...z.vertex,header:z.vertex.header.replace("group(1)","group(2)")}},te={name:"local-uniform-bit",vertex:{header:`

            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,main:`
            vColor *= uColor;
            modelMatrix = uTransformMatrix;
        `,end:`
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `}};class ee{constructor(){this.batcherName="default",this.topology="triangle-list",this.attributeSize=4,this.indexSize=6,this.packAsQuad=!0,this.roundPixels=0,this._attributeStart=0,this._batcher=null,this._batch=null}get blendMode(){return this.renderable.groupBlendMode}get color(){return this.renderable.groupColorAlpha}reset(){this.renderable=null,this.texture=null,this._batcher=null,this._batch=null,this.bounds=null}destroy(){}}export{ee as B,Ot as D,Jt as F,R as V,Et as a,z as b,Rt as c,xt as d,$t as e,$ as f,Lt as g,Ft as h,Wt as i,te as j,Xt as k,Zt as l,Yt as m,Nt as r};
