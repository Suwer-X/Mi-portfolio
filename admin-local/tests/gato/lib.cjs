/* Utilidades de las pruebas del gato: crea una copia temporal del portfolio con un catálogo de ejemplo (el tuyo no se toca). */
const fs=require('fs'),path=require('path'),os=require('os');
const { startServer, cloneProject, sleep, chromium } = require('../harness.cjs');
// PNG 1x1 válido
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const CATALOG={projects:[
 {name:'Laboratorio VLAN',description:'Segmentación de red con VLANs en Packet Tracer',category:'Redes',tags:['VLAN','CCNA','Cisco'],date:'2026-05-01',file:'vlan/captura.png',size:70,cover:'vlan/captura.png'},
 {name:'Servidor DHCP en Windows Server',description:'Configuración de ámbitos y reservas',category:'Sistemas',tags:['Windows','DHCP'],date:'2026-04-01',file:'dhcp/memoria.pdf'},
 {name:'Despliegue LAMP',description:'Apache, MySQL y PHP sobre Linux',category:'Servicios web',tags:['Linux','Apache','PHP'],link:'https://github.com/x/y'},
 {name:'Juego en Python',description:'Pequeño videojuego de plataformas',category:'Programación',tags:['Python','Juegos'],date:'2026-03-01',file:'juego/main.py',files:[{file:'juego/readme.txt',name:'Léeme'}]},
 {name:'Diseño de bases de datos',description:'Modelo relacional en PostgreSQL',category:'Bases de datos',tags:['SQL','PostgreSQL'],file:'bd/esquema.sql'},
 {name:'BORRADOR SECRETO',description:'No debe verse',category:'Redes',tags:['VLAN'],file:'x/y.txt',published:false},
 {name:'OTRO BORRADOR',description:'No debe verse',tags:['Python'],file:'x/z.txt',status:'draft'},
]};
function makeSite({catalog=CATALOG,dataJs=true}={}){
  const dir=cloneProject(path.resolve(__dirname,'../../..'));
  const sp=path.join(dir,'sources/projects'); fs.mkdirSync(sp,{recursive:true});
  const w=(rel,data)=>{fs.mkdirSync(path.dirname(path.join(sp,rel)),{recursive:true});fs.writeFileSync(path.join(sp,rel),data)};
  w('vlan/captura.png',PNG); w('dhcp/memoria.pdf','%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'); w('juego/main.py','print("hola")\n'); w('juego/readme.txt','léeme'); w('bd/esquema.sql','select 1;');w('x/y.txt','x');w('x/z.txt','z');
  w('projects.json',JSON.stringify(catalog,null,2));
  fs.writeFileSync(path.join(dir,'sources/cv_xiang_su_liu.pdf'),'%PDF-1.1\n%%EOF');
  if(dataJs)require('child_process').execFileSync('node',[path.join(dir,'tools/sync-catalog.cjs')],{cwd:dir});
  return dir;
}
module.exports={makeSite,sleep,chromium,startServer,PNG,CATALOG,fs,path};
