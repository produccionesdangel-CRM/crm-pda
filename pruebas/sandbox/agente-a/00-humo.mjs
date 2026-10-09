/* 00-humo.mjs — comprueba el arnés: aislamiento, siembra base, captura de avisos. */
import { abrirCaja, ataque, guardar, foto } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Humo' });
console.log('Sello:      ' + caja.info.sello);
console.log('Aislado:    ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + '  ' + JSON.stringify({
  sandbox: caja.aislamiento.sandbox, database: caja.aislamiento.database, auth: caja.aislamiento.auth,
  fugasDatos: caja.aislamiento.fugasDatos.length, sdkIntentos: caja.aislamiento.sdkIntentos
}));
console.log('Instrumento:' + JSON.stringify(caja.inst));
console.log('Biblioteca: ' + JSON.stringify(caja.bib));
console.log('Base:       ' + JSON.stringify(caja.base));
console.log('Sembrado:   ' + JSON.stringify(caja.semb));

const f = await foto(caja);
console.log('Almacén:    ' + f.inv.clientes + ' clientes · ' + f.inv.prospectos + ' prospectos · ' + f.inv.contratos + ' contratos · ' + f.inv.campanias + ' campañas · ' + f.inv.participaciones + ' participaciones');

await ataque(caja, {
  id: 'H1', nombre: 'Aviso de campo obligatorio (control de captura de avisos)',
  dato: 'nombre de prospecto vacío', esperado: 'mensaje de campos obligatorios', gravedad: 'BAJA',
  js: `var n0 = prospectos.length;
       var r = __R.prospecto({ nombre: '   ', telefono: '', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: prospectos.length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'leído=' + JSON.stringify(r.leido) + ' · envío=' + r.envio + ' · prospectos ' + n0 + ' → ' + prospectos.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await guardar(caja, '00-humo');
