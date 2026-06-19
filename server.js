// =========================================================================
// Backend de Render - Archivo: server.js
// Repositorio: joseMorales2019 / apiAvatar (Rama: main)
// Service ID: srv-d8m9dnsvikkc73duvo10
// URL de API: https://apiavatar.onrender.com
// =========================================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import sharp from "sharp";
import axios from "axios";

dotenv.config();

console.log("\n=================================");
console.log("🚀 INICIANDO SERVIDOR MULTI-API OPTIMIZADO");
console.log("=================================");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CONFIGURACIÓN DE MIDDLEWARES Y CORS
// ========================================
app.use(cors({
  origin: "*",  // Permite llamadas web desde cualquier origen de forma segura (ej. https://www.newbank.store)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ========================================
// RECOLECTOR DE LOGS DE PETICIONES
// ========================================
app.use((req, res, next) => {
  console.log("\n=================================");
  console.log("📥 NUEVA PETICIÓN DETECTADA");
  console.log("=================================");
  console.log("Método:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("IP de Origen:", req.ip);
  next();
});

// ========================================
// SISTEMA DE REINTENTOS DINÁMICOS CON RETROCESO EXPONENCIAL
// Evita fallos críticos 503 (Servicio no disponible) y 429 (Tasa de límite)
// ========================================
async function retryWithExponentialBackoff(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    const isRetriable =
      retries > 0 &&
      (status === 503 ||
       status === 429 ||
       error?.error?.code === 503 ||
       error?.error?.code === 429 ||
       error?.message?.includes("503") ||
       error?.message?.includes("UNAVAILABLE") ||
       error?.message?.includes("high demand") ||
       error?.message?.includes("429") ||
       error?.response?.data?.error?.message?.includes("high demand"));

    if (isRetriable) {
      console.warn(`⚠️ [API Retry] Alerta de demanda o rate-limit detectada en la API. Reintentando en ${delay}ms... (${retries} intentos restantes)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithExponentialBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// ========================================
// VALIDACIÓN DE CREDENCIALES
// ========================================
if (process.env.OPENAI_API_KEY) {
  console.log("✅ OPENAI_API_KEY: Configurada correctamente.");
} else {
  console.log("⚠️ OPENAI_API_KEY: No encontrada. Se utilizarán fallback locales.");
}

if (process.env.XAI_API_KEY) {
  console.log("✅ XAI_API_KEY (Grok Video): Configurada correctamente.");
} else {
  console.log("⚠️ XAI_API_KEY (Grok Video): No encontrada. Se activará el modo de simulación de video.");
}

// Inicialización del Cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const XAI_API_URL = "https://api.x.ai/v1";

// ========================================
// INSTRUCCIÓN DE SISTEMA PARA REPLYS EN EL SALVADOR
// ========================================
const getSystemInstruction = (userDisplayName = "Amigo", isDefaulter = false, products = null) => {
  return `Eres un asistente conversacional experto, amigable, empático y que se siente sumamente humano. Hablas con un acento y carisma salvadoreño muy hospitalario.
Tu nombre oficial es "asesor virtual de NewBank AI".

Tu propósito primordial es asesorar y guiar sobre los servicios de NewBank AI: brindamos productos al contado, al credito y sin complicaciones para salvadoreños trabajadores, ideales para comprar celulares, electrodomésticos y tecnología para el hogar.

Al recibir cualquier mensaje del usuario, primero analiza el contexto completo de la conversación.
- Identifica automáticamente saludos o señales de inicio de interacción como "hola", "Hola", "hi", "HI", "buenos días", "buenas tardes", "cómo estás", "qué tal", o cualquier otra expresión similar. En esos casos, responde de forma cálida y natural para mantener una conversación amena, fluida y agradable, enfocándose en conocer mejor al usuario y generar rapport.
- Evita repeticiones innecesarias en tus respuestas. Mantén un tono amigable, empático y conversacional sin sonar robótico.

REGLAS DE NEGOCIO IMPORTANTES:
1. Hablas con ${userDisplayName}. ${isDefaulter ? 'Tiene una cuota pendiente de un microcrédito. No seas rudo, sé empático y ofrécele opciones amigables de la tienda para que siga disfrutando de las novedades, pero jamás lo amenaces ni seas cobrador molesto. Trátalo con el máximo amor humano.' : 'Es un cliente de plena confianza.'}
2. NO menciones nada sobre "canjear puntos de reputación" o "analizar perfiles de confianza, límites o créditos de puntos". Esas cosas no deben ser habladas.
3. Enfócate principalmente en conocer mejor al usuario, sus necesidades de hogar o vida diaria, y cómo NewBank AI le puede ayudar a financiar estos productos con cuotas chiquitas y aprobación en 5 minutos.
4. Si pregunta por algún artículo de la tienda o precios, puedes basarte en la lista de productos: ${JSON.stringify(products && products.length > 0 ? products : [
    { name: "Xiaomi Redmi Note 13", price: 185, description: "Teléfono de 256 gigas, 8 gigas de memoria RAM, súper cámara de 108 megapíxeles y batería de larga duración.", category: "Estilo de vida", stock: 8 },
    { name: "Licuadora Black & Decker de vidrio", price: 45, description: "Potencia de 550 vatios, vaso de vidrio grueso de 1.5 litros, ideal para la cocina.", category: "Hogar", stock: 12 },
    { name: "Ventilador de Pedestal Premium", price: 35, description: "Ventilador de 16 pulgadas, 3 velocidades de aire fresco, súper silencioso para descansar.", category: "Hogar", stock: 15 },
    { name: "Audífonos Inalámbricos JBL Tune", price: 55, description: "Diadema con conexión bluetooth, sonido con graves puros de alta definición y batería de hasta 40 horas.", category: "Accesorios", stock: 6 },
    { name: "Smartwatch Deportivo T500", price: 40, description: "Pantalla táctil, monitoreo de salud, recibe notificaciones de Whatsapp y llamadas, resistente al agua.", category: "Accesorios", stock: 10 }
  ])}.
5. Indícale que para comprar o solicitar cualquier producto de la pantalla con su microcrédito NewBank AI, solo debe seleccionarlo y presionar el botón correspondiente; esto abrirá un chat de WhatsApp con nuestros asesores para pre-aprobar su solicitud al instante.
6. Si dice adiós o gracias para despedirse, despídete con muchísimo cariño y deséale bendiciones, indicando que nos mantendremos en contacto. Te despides y el diálogo interactivo se cerrará pronto de manera natural.
7. Si te pide un chiste, cuéntale uno salvadoreño muy corto y alegre, como por ejemplo: "¿Por qué los pajaritos no usan calculadoras? ¡Porque prefieren hacer sus cuentas con el pico y volar libres en El Salvador!" o similar.

Mantén tus respuestas sumamente cortas, de máximo 2 o 3 frases. Ve al grano, no aburras ni acoses al cliente con información técnica ni explicaciones largas sobre tasas de interés. Sé alegre, servicial e de inmediato invita al cliente a estrenar hoy mismo con NewBank AI. No utilices asteriscos o formato Markdown de negrita pesada en el texto (ejemplo: NO uses '**' ni '#' ni listas con guiones), ya que será interpretado por síntesis de voz (TTS). Usa texto plano natural.`;
};

// ========================================
// UTILIDADES AUXILIARES
// ========================================
async function convertirAWebp(buffer) {
  return await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// MANEJADOR MULTI-ENDPOINT: CHAT IA (OpenAI con Retry)
// Adopta parámetros en inglés/español y devuelve salidas unificadas (reply y respuesta)
// ========================================
const handlerChat = async (req, res) => {
  try {
    const { mensaje, message, history, detectedUser, products } = req.body;
    const finalMsg = mensaje || message;

    if (!finalMsg) {
      return res.status(400).json({
        ok: false,
        error: "No se recibió ningún parámetro de pregunta o mensaje"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      const defaultFallback = "¡Hola! Para iniciar tu crédito NewBank rápido por WhatsApp escríbenos directamente en el enlace.";
      return res.json({
        ok: true,
        respuesta: defaultFallback,
        reply: defaultFallback
      });
    }

    const name = detectedUser?.name || "Amigo";
    const isDefaulter = detectedUser?.isDefaulter || false;
    const systemPrompt = getSystemInstruction(name, isDefaulter, products);

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (Array.isArray(history)) {
      for (const conv of history) {
        messages.push({
          role: conv.role === 'model' || conv.role === 'assistant' ? 'assistant' : 'user',
          content: conv.text || conv.content
        });
      }
    }

    messages.push({ role: "user", content: finalMsg });

    // Ejecución segura de OpenAI Chat Completion con Exponential Backoff
    const completion = await retryWithExponentialBackoff(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.75,
      });
    });

    const aiResponse = completion.choices[0].message.content || "...";

    return res.json({
      ok: true,
      respuesta: aiResponse,
      reply: aiResponse // Proporciona compatibilidad integral para cualquier variante del frontend
    });

  } catch (error) {
    console.error("❌ ERROR INTERNO EN CHAT:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el controlador de chat",
      detalle: error.message
    });
  }
};

// ========================================
// MANEJADOR SÍNCRONO GENERACIÓN DE VIDEO (xAI Grok con Retry)
// ========================================
const handlerVideo = async (req, res) => {
  console.log("🎬 ENTRÓ A /video (Proceso Síncrono)");
  try {
    const { imageUrl, prompt, duration } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        ok: false,
        error: "Falta parámetro imageUrl para guiar la animación"
      });
    }

    if (!process.env.XAI_API_KEY) {
      console.log("⚠️ Sin XAI_API_KEY, aplicando fallback a video simulado de avatar...");
      await sleep(3500);
      const mockVideo = "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/avatar-default-loop.mp4";
      return res.json({
        ok: true,
        provider: "xAI Grok Video Simulator",
        videoUrl: mockVideo
      });
    }

    let finalPrompt = prompt || `A cinematic ultra realistic human avatar. Natural body movement. Friendly expressions. Professional online seller. Smooth motion.`;

    if (!finalPrompt.toLowerCase().includes("español") && !finalPrompt.toLowerCase().includes("spanish")) {
      finalPrompt += " El personaje habla e interactúa única y exclusivamente con expresiones de habla española.";
    }

    const createResponse = await retryWithExponentialBackoff(async () => {
      return await axios.post(
        `${XAI_API_URL}/videos/generations`,
        {
          model: "grok-imagine-video",
          prompt: finalPrompt,
          image: { url: imageUrl },
          duration: duration || 5
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.XAI_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
    });

    const requestId = createResponse.data.request_id;
    if (!requestId) {
      return res.status(500).json({
        ok: false,
        error: "No se recibió un request_id válido de Grok"
      });
    }

    let completed = false;
    let failed = false;
    let videoUrlResult = null;
    let attempts = 0;
    const maxAttempts = 18; // ~108 segundos de tiempo de espera

    while (!completed && !failed && attempts < maxAttempts) {
      console.log(`⏳ Esperando generación de video... Intento ${attempts + 1}/${maxAttempts}`);
      await sleep(6000);
      attempts++;

      const pollResponse = await retryWithExponentialBackoff(async () => {
        return await axios.get(
          `${XAI_API_URL}/videos/${requestId}`,
          {
            headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` }
          }
        );
      });

      const statusData = pollResponse.data;
      if (statusData.status === "done") {
        completed = true;
        videoUrlResult = statusData.video?.url;
      } else if (statusData.status === "failed" || statusData.status === "expired") {
        failed = true;
      }
    }

    if (failed || !videoUrlResult) {
      return res.status(500).json({
        ok: false,
        error: "Fallo durante el procesamiento de video en xAI o expiración de tiempo de espera"
      });
    }

    return res.json({
      ok: true,
      provider: "xAI Grok Imagine",
      videoUrl: videoUrlResult
    });

  } catch (error) {
    console.error("❌ ERROR INTERNO GENERACIÓN VIDEO:", error.response?.data || error.message);
    return res.status(500).json({
      ok: false,
      error: "Error inesperado al renderizar video",
      detalle: error.response?.data || error.message
    });
  }
};

// ========================================
// MANEJADORES DE SERVICIOS ADICIONALES PROGRESSIVE (xAI Grok con Retry)
// ========================================
const handlerVideoStart = async (req, res) => {
  try {
    const { imageUrl, prompt, duration } = req.body;
    const finalImg = imageUrl || "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankAvatarImagen/modelo%20final.png";
    const key = process.env.XAI_API_KEY;

    if (!key) {
      const mockId = `mock_grok_${Date.now()}`;
      return res.json({ success: true, ok: true, mock: true, id: mockId, request_id: mockId });
    }

    const createResponse = await retryWithExponentialBackoff(async () => {
      return await axios.post(
        `${XAI_API_URL}/videos/generations`,
        {
          model: "grok-imagine-video",
          prompt: prompt || "A professional friendly Salvadoran banker avatar talking details.",
          image: { url: finalImg },
          duration: duration || 5
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json"
          }
        }
      );
    });

    return res.json({
      success: true,
      ok: true,
      mock: false,
      id: createResponse.data.request_id,
      request_id: createResponse.data.request_id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const handlerVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const key = process.env.XAI_API_KEY;

    if (id.startsWith("mock_grok_")) {
      const createdTime = parseInt(id.replace("mock_grok_", ""));
      const elapsed = (Date.now() - createdTime) / 1000;

      if (elapsed < 3) {
        return res.json({ status: "in-progress", progress: 25, progress_text: "Encolando animación en xAI Grok..." });
      } else if (elapsed < 6) {
        return res.json({ status: "in-progress", progress: 55, progress_text: "Procesando frames..." });
      } else {
        const mockVideo = "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/avatar-default-loop.mp4";
        return res.json({ status: "completed", progress: 100, video_url: mockVideo, videoUrl: mockVideo, is_mock: true });
      }
    }

    if (!key) {
      return res.status(400).json({ error: "Falta XAI_API_KEY en el servidor" });
    }

    const pollResponse = await retryWithExponentialBackoff(async () => {
      return await axios.get(`${XAI_API_URL}/videos/${id}`, {
        headers: { Authorization: `Bearer ${key}` }
      });
    });

    const data = pollResponse.data;
    if (data.status === "done") {
      return res.json({ status: "completed", progress: 100, video_url: data.video?.url, videoUrl: data.video?.url });
    } else if (data.status === "failed" || data.status === "expired") {
      return res.status(500).json({ error: "Generación fallida de video" });
    } else {
      return res.json({ status: "in-progress", progress: 50, progress_text: "Grok está animando tu de video..." });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// MANEJADORES EXTRA: IMÁGENES Y ANÁLISIS
// ========================================
const handlerImagen = async (req, res) => {
  try {
    const { prompt, size } = req.body;
    if (!prompt) return res.status(400).json({ ok: false, error: "No se recibió prompt" });

    const result = await retryWithExponentialBackoff(async () => {
      return await openai.images.generate({
        model: "dall-e-3",
        prompt,
        size: size || "1024x1024"
      });
    });

    const image = result.data?.[0];
    if (!image) return res.status(500).json({ ok: false, error: "Dall-E no generó la imagen" });

    let buffer;
    if (image.url) {
      const response = await axios.get(image.url, { responseType: "arraybuffer" });
      buffer = Buffer.from(response.data);
    } else if (image.b64_json) {
      buffer = Buffer.from(image.b64_json, "base64");
    }

    const webpBuffer = await convertirAWebp(buffer);
    return res.json({ ok: true, formato: "webp", imagen: webpBuffer.toString("base64") });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

const handlerAnalizarImagen = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ ok: false, error: "Falta imageUrl" });

    const response = await retryWithExponentialBackoff(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Describe detalladamente esta imagen" },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }]
      });
    });

    return res.json({ ok: true, analisis: response.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

// ========================================
// HEALTH CHECKS
// ========================================
const handlerHealth = (req, res) => {
  res.status(200).json({
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

const handlerRoot = (req, res) => {
  res.json({
    estado: "ok",
    mensaje: "Servidor NewBank AI Avatar activo y listo para conexiones de origen cruzado."
  });
};

// ========================================
// MAPEO DE RUTAS: SOPORTE CON Y SIN PREFIJO /API
// ========================================
app.get("/", handlerRoot);
app.get("/health", handlerHealth);
app.get("/api/health", handlerHealth);
app.get("/test", handlerRoot);

// Chat Endpoints
app.post("/chat", handlerChat);
app.post("/api/chat", handlerChat);

// Video generator endpoints (Synchronous)
app.post("/video", handlerVideo);
app.post("/api/video", handlerVideo);

// Video generator progressive task endpoints (Asynchronous)
app.post("/video-start", handlerVideoStart);
app.post("/api/video-start", handlerVideoStart);
app.get("/video-status/:id", handlerVideoStatus);
app.get("/api/video-status/:id", handlerVideoStatus);

// Image creation & analysis
app.post("/imagen", handlerImagen);
app.post("/api/imagen", handlerImagen);
app.post("/analizar-imagen", handlerAnalizarImagen);
app.post("/api/analizar-imagen", handlerAnalizarImagen);

// ========================================
// MANEJO DE PETICIONES 404
// ========================================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Recurso no encontrado en el servidor Render",
    metodo: req.method,
    url: req.originalUrl
  });
});

process.on("uncaughtException", (err) => {
  console.error("🔴 EXCEPCIÓN NO CONTROLADA (uncaughtException):", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔴 RECHAZO NO MANEJADO (unhandledRejection):", err);
});

// Iniciación de Escucha del Servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log("\n=================================");
  console.log("🌐 SERVIDOR CORRIENDO EXITOSAMENTE");
  console.log("=================================");
  console.log(`Servidor activo en: http://localhost:${PORT}`);
  console.log("=================================\n");
});