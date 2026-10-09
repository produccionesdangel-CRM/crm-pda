"""
medir-clay.py — mide de verdad la separación entre el fondo y las tarjetas.

No se juzga a ojo: se leen los píxeles de las capturas y se calculan dos cosas.

  1. MANCHAS: cuánta luz hay entre la parte más clara y la más oscura del fondo.
     Se mide en `fondo-<tema>.png`, una captura donde las tarjetas y el panel
     están escondidos, así que TODO lo que se ve es fondo. Si el número es casi
     cero, las manchas de degradado no se ven aunque estén escritas en el CSS.

  2. SEPARA: cuánta luz hay entre el interior de una tarjeta y el fondo que la
     rodea. Menos de 4 puntos se percibe como "el mismo color"; de 8 a 20 se
     distingue bien; más de 25 ya es contraste fuerte.

Uso:  python preview\\medir-clay.py
"""
import os
import sys
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
TEMAS = ["dark", "light", "otono", "angel"]

# Rejilla sobre el ÁREA DE TRABAJO (sin barra lateral ni panel), en proporción.
REJILLA_X = [0.20, 0.30, 0.40, 0.50, 0.60]
REJILLA_Y = [0.08, 0.25, 0.42, 0.59, 0.76, 0.93]
# Interior de las tarjetas en la captura con contenido (zona sin texto).
CARDS = [(0.29, 0.44), (0.53, 0.44), (0.29, 0.86), (0.53, 0.86)]


def lum(px):
    return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]


def muestra(img, x, y, lado=7):
    caja = img.crop((x - lado, y - lado, x + lado, y + lado)).resize((1, 1), Image.LANCZOS)
    return caja.getpixel((0, 0))


def fondo_de(tema):
    img = Image.open(os.path.join(AQUI, "fondo-" + tema + ".png")).convert("RGB")
    w, h = img.size
    valores = [lum(muestra(img, int(w * fx), int(h * fy))) for fy in REJILLA_Y for fx in REJILLA_X]
    return min(valores), max(valores)


def tarjeta_de(tema):
    img = Image.open(os.path.join(AQUI, "contratos-" + tema + ".png")).convert("RGB")
    w, h = img.size
    valores = [lum(muestra(img, int(w * fx), int(h * fy))) for fx, fy in CARDS]
    return sum(valores) / len(valores)


def main():
    print("Fondo y tarjetas (luminancia 0-255)")
    print("")
    print(f"{'tema':7} {'fondo min':>10} {'fondo max':>10} {'manchas':>9} {'tarjeta':>9} {'separa':>8}")
    for tema in TEMAS:
        try:
            f_min, f_max = fondo_de(tema)
            t_med = tarjeta_de(tema)
        except FileNotFoundError as e:
            print(f"{tema:7} (falta una captura: {os.path.basename(e.filename)})")
            continue
        dif = t_med - (f_min + f_max) / 2
        # En Otoño y Ángel las tarjetas son MÁS OSCURAS que el fondo (Jorge pidió
        # invertirlos): ahí lo que importa es cuánta diferencia hay, no el signo.
        sentido = "más oscuras" if dif < 0 else "más claras"
        print(f"{tema:7} {f_min:10.1f} {f_max:10.1f} {f_max - f_min:9.1f} {t_med:9.1f} {abs(dif):8.1f}  {sentido}")
    print("")
    print("Metas que se buscan:  manchas = 14 a 30   ·   separa = 24 a 36 (sin importar el sentido)")
    print("(manchas por debajo de 8 casi no se ven; 'separa' por encima de 42 ya ensucia)")


if __name__ == "__main__":
    sys.exit(main())
