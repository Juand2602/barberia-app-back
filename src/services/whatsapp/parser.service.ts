// src/services/whatsapp/parser.service.ts
export class MessageParserService {
  parsearFecha(texto: string): Date | null {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const textoLower = texto.toLowerCase().trim();

    if (textoLower === 'hoy') {
      return hoy;
    }

    if (textoLower === 'mañana' || textoLower === 'manana') {
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      return manana;
    }

    if (textoLower === 'pasado mañana' || textoLower === 'pasado manana') {
      const pasadoManana = new Date(hoy);
      pasadoManana.setDate(pasadoManana.getDate() + 2);
      return pasadoManana;
    }

    return null;
  }

  parsearOpcionNumerica(texto: string, max: number): number | null {
    const numero = parseInt(texto.trim());
    if (isNaN(numero) || numero < 1 || numero > max) {
      return null;
    }
    return numero;
  }

  normalizarRespuesta(texto: string): string {
    return texto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s,]/g, '') // Quitar emojis/puntuación extra
      .replace(/\s+/g, ' ')
      .trim();
  }

  esAfirmativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    // aceptamos variantes: sí, si, s, yes, ok, 1
    return ['si', 'sí', 's', 'yes', 'ok', '1', 'si, cancelar', 'si cancelar'].some((v) =>
      normalizado === v || normalizado.includes(v)
    );
  }

  esNegativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    // aceptamos variantes: no, 2, nop, nope
    return ['no', '2', 'nop', 'nope', 'n', 'no, conservar', 'no conservar'].some((v) =>
      normalizado === v || normalizado.includes(v)
    );
  }
}

export const messageParser = new MessageParserService();
