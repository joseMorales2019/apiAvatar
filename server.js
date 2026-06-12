import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import sharp from "sharp";
import axios from "axios";

dotenv.config();

console.log("\n=================================");
console.log("🚀 INICIANDO SERVIDOR");
console.log("=================================");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARES
// ========================================

app.use(cors());

app.use(express.json({
  limit: "50mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "50mb"
}));

// ========================================
// LOGS GLOBALES
// ========================================

app.use((req, res, next) => {

  console.log("\n=================================");
  console.log("📥 NUEVA PETICIÓN");
  console.log("=================================");

  console.log("Método:", req.method);
  console.log("URL:", req.originalUrl);

  console.log("Body:");
  console.log(req.body);

  console.log("=================================\n");

  next();

});

// ========================================
// VALIDAR API KEYS
// ========================================

if (process.env.OPENAI_API_KEY) {

  console.log("✅ OPENAI API KEY ENCONTRADA");

} else {

  console.log("❌ OPENAI API KEY NO ENCONTRADA");

}

if (process.env.XAI_API_KEY) {

  console.log("✅ XAI API KEY ENCONTRADA");

} else {

  console.log("❌ XAI API KEY NO ENCONTRADA");

}

// ========================================
// CLIENTE OPENAI
// ========================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ========================================
// CONFIG XAI
// ========================================

const XAI_API_URL =
  "https://api.x.ai/v1";

// ========================================
// UTILIDAD WEBP
// ========================================

async function convertirAWebp(buffer) {

  return await sharp(buffer)
    .webp({
      quality: 85
    })
    .toBuffer();

}

// ========================================
// UTILIDAD SLEEP
// ========================================

function sleep(ms) {

  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );

}

// ========================================
// RUTAS BÁSICAS
// ========================================

app.get("/", (req, res) => {

  res.json({

    estado: "ok",

    mensaje:
      "Servidor funcionando correctamente"

  });

});

app.get("/test", (req, res) => {

  res.json({

    estado: "ok",

    mensaje:
      "Ruta test funcionando"

  });

});

// ========================================
// CHAT IA
// ========================================

app.post("/chat", async (req, res) => {

  try {

    const { mensaje } = req.body;

    if (!mensaje) {

      return res.status(400).json({

        ok: false,

        error:
          "No se recibió mensaje"

      });

    }

    const response =
      await openai.responses.create({

        model: "gpt-5",

        input: mensaje

      });

    return res.json({

      ok: true,

      respuesta:
        response.output_text

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      ok: false,

      error:
        "Error en chat",

      detalle:
        error.message

    });

  }

});

// ========================================
// GENERAR IMAGEN
// ========================================

app.post("/imagen", async (req, res) => {

  console.log("🎨 ENTRÓ A /imagen");

  try {

    const {
      prompt,
      size
    } = req.body;

    if (!prompt) {

      return res.status(400).json({

        ok: false,

        error:
          "No se recibió prompt"

      });

    }

    const result =
      await openai.images.generate({

        model: "gpt-image-1",

        prompt,

        size:
          size || "1024x1024"

      });

    const image =
      result.data?.[0];

    if (!image) {

      return res.status(500).json({

        ok: false,

        error:
          "No se generó imagen"

      });

    }

    let buffer;

    // ====================================
    // URL
    // ====================================

    if (image.url) {

      const response =
        await axios.get(image.url, {

          responseType:
            "arraybuffer"

        });

      buffer =
        Buffer.from(response.data);

    }

    // ====================================
    // BASE64
    // ====================================

    if (image.b64_json) {

      buffer =
        Buffer.from(
          image.b64_json,
          "base64"
        );

    }

    if (!buffer) {

      return res.status(500).json({

        ok: false,

        error:
          "No se pudo obtener buffer"

      });

    }

    // ====================================
    // WEBP
    // ====================================

    const webpBuffer =
      await convertirAWebp(buffer);

    const webpBase64 =
      webpBuffer.toString("base64");

    console.log("✅ IMAGEN WEBP GENERADA");

    return res.json({

      ok: true,

      formato:
        "webp",

      imagen:
        webpBase64

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      ok: false,

      error:
        "Error generando imagen",

      detalle:
        error.message

    });

  }

});

// ========================================
// ANALIZAR IMAGEN
// ========================================

app.post("/analizar-imagen", async (req, res) => {

  try {

    const { imageUrl } = req.body;

    if (!imageUrl) {

      return res.status(400).json({

        ok: false,

        error:
          "No se recibió imageUrl"

      });

    }

    const response =
      await openai.responses.create({

        model: "gpt-5",

        input: [

          {
            role: "user",

            content: [

              {
                type: "input_text",

                text:
                  "Describe detalladamente esta imagen"

              },

              {
                type: "input_image",

                image_url:
                  imageUrl

              }

            ]

          }

        ]

      });

    return res.json({

      ok: true,

      analisis:
        response.output_text

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      ok: false,

      error:
        "Error analizando imagen",

      detalle:
        error.message

    });

  }

});

// ========================================
// GENERAR VIDEO CON GROK
// ========================================

app.post("/video", async (req, res) => {

  console.log("🎬 ENTRÓ A /video");

  try {

    const {
      imageUrl,
      prompt,
      duration
    } = req.body;

    // ====================================
    // VALIDAR INPUTS
    // ====================================

    if (!imageUrl) {

      return res.status(400).json({

        ok: false,

        error:
          "No se recibió imageUrl"

      });

    }

    // ====================================
    // PROMPT FINAL
    // ====================================

    const finalPrompt =
      prompt ||
      `
      A cinematic ultra realistic human avatar.
      Natural body movement.
      Friendly facial expressions.
      Realistic lighting.
      Professional online seller.
      Smooth motion.
      High quality commercial video.
      `;

    console.log("🧠 PROMPT:");
    console.log(finalPrompt);

    // ====================================
    // CREAR VIDEO
    // ====================================

    const createResponse =
      await axios.post(

        `${XAI_API_URL}/videos/generations`,

        {

          model:
            "grok-imagine-video",

          prompt:
            finalPrompt,

          image: {

            url:
              imageUrl

          },

          duration:
            duration || 5

        },

        {

          headers: {

            Authorization:
              `Bearer ${process.env.XAI_API_KEY}`,

            "Content-Type":
              "application/json"

          }

        }

      );

    console.log("📡 RESPUESTA XAI:");
    console.log(createResponse.data);

    // ====================================
    // REQUEST ID
    // ====================================

    const requestId =
      createResponse.data.request_id;

    if (!requestId) {

      return res.status(500).json({

        ok: false,

        error:
          "No se recibió request_id"

      });

    }

    console.log("🆔 REQUEST ID:");
    console.log(requestId);

    // ====================================
    // POLLING
    // ====================================

    let completed = false;

    let failed = false;

    let videoUrl = null;

    while (!completed && !failed) {

      console.log("⏳ ESPERANDO VIDEO...");

      await sleep(5000);

      const pollResponse =
        await axios.get(

          `${XAI_API_URL}/videos/${requestId}`,

          {

            headers: {

              Authorization:
                `Bearer ${process.env.XAI_API_KEY}`

            }

          }

        );

      const data =
        pollResponse.data;

      console.log("📡 STATUS:");
      console.log(data);

      // ====================================
      // VIDEO TERMINADO
      // ====================================

      if (data.status === "done") {

        completed = true;

        videoUrl =
          data.video?.url;

      }

      // ====================================
      // ERROR
      // ====================================

      if (
        data.status === "failed" ||
        data.status === "expired"
      ) {

        failed = true;

      }

    }

    // ====================================
    // ERROR FINAL
    // ====================================

    if (failed) {

      return res.status(500).json({

        ok: false,

        error:
          "xAI no pudo generar el video"

      });

    }

    // ====================================
    // RESPUESTA FINAL
    // ====================================

    return res.json({

      ok: true,

      provider:
        "xAI Grok Imagine",

      videoUrl

    });

  } catch (error) {

    console.log("\n❌ ERROR VIDEO ❌");

    console.log(
      error.response?.data ||
      error.message ||
      error
    );

    return res.status(500).json({

      ok: false,

      error:
        "Error generando video",

      detalle:
        error.response?.data ||
        error.message

    });

  }

});

// ========================================
// 404
// ========================================

app.use((req, res) => {

  res.status(404).json({

    ok: false,

    error:
      "Ruta no encontrada",

    metodo:
      req.method,

    url:
      req.originalUrl

  });

});

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {

  console.log("\n=================================");
  console.log("🚀 SERVIDOR EJECUTÁNDOSE");
  console.log("=================================");

  console.log(
    `🌐 http://localhost:${PORT}`
  );

  console.log("=================================\n");

});