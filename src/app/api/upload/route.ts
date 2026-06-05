import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { numeroHC, imageBase64, sizeKB, timestamp } = body;

    // Validaciones básicas
    if (!numeroHC || typeof numeroHC !== 'string') {
      return NextResponse.json(
        { error: 'El Número de Historia Clínica es requerido y debe ser un texto.' },
        { status: 400 }
      );
    }
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'La imagen en formato Base64 es requerida.' },
        { status: 400 }
      );
    }

    // OPCIÓN A: Si está configurada la variable GOOGLE_SCRIPT_URL (Apps Script Web App)
    // Esto simplifica el proceso al no requerir Cuenta de Servicio
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (scriptUrl) {
      console.log('Utilizando Google Apps Script para guardar los datos...');
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numeroHC,
          imageBase64,
          sizeKB,
          timestamp,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Error al parsear respuesta de Apps Script. Crudo:', text);
        return NextResponse.json(
          { error: 'Respuesta inválida de Google Apps Script. Asegúrate de implementarlo como Web App.' },
          { status: 502 }
        );
      }

      if (response.ok && data.success !== false) {
        return NextResponse.json({
          success: true,
          message: 'Datos guardados exitosamente en Google Sheets vía Apps Script.',
          idGenerado: data.idGenerado,
          fechaCaptura: data.fechaCaptura,
        });
      } else {
        return NextResponse.json(
          { error: data.error || 'Error reportado por el script de Google Apps Script.' },
          { status: 502 }
        );
      }
    }

    // OPCIÓN B: Conexión directa mediante Google Sheets API y Cuenta de Servicio
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error('Faltan variables de entorno de Google Sheets en el servidor.');
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta (Ingresa GOOGLE_SCRIPT_URL o las credenciales de la Cuenta de Servicio).' },
        { status: 500 }
      );
    }

    // Formatear la clave privada para corregir los escapes de saltos de línea \n
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Inicializar el cliente de autenticación de Google Cloud
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Generar un ID único basado en fecha y hora + número aleatorio
    const now = new Date(timestamp || Date.now());
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const idGenerado = `ID-${year}${month}${day}-${hours}${minutes}${seconds}-${Math.floor(1000 + Math.random() * 9000)}`;
    const fechaCaptura = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const range = 'A:E'; 

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            idGenerado,
            numeroHC.trim(),
            fechaCaptura,
            sizeKB ? `${parseFloat(sizeKB).toFixed(1)} KB` : 'N/A',
            imageBase64
          ]
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Datos guardados exitosamente en Google Sheets.',
      idGenerado,
      fechaCaptura,
    });

  } catch (error: any) {
    console.error('Error detallado en la API Route /api/upload:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al subir a Google Sheets.', details: error.message || error },
      { status: 500 }
    );
  }
}
