"use strict";

const fs = require("fs");
const path = require("path");
const { createStrapi } = require("@strapi/strapi");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SEED_FILE = path.join(PROJECT_ROOT, ".seed-test-data.json");

/*
 * Objetivo total de pedidos generados por este script.
 *
 * Estos números incluyen los pedidos que ya están registrados
 * actualmente en .seed-test-data.json.
 */
const TARGETS = {
  2024: 600,
  2025: 600,
  2026: 450,
};

const CANCELLATION_RATE = 0.10;

// Semilla fija para mantener una distribución reproducible.
let randomState = 20261005;

function random() {
  randomState =
    (randomState * 1664525 + 1013904223) % 4294967296;

  return randomState / 4294967296;
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomItem(array) {
  return array[Math.floor(random() * array.length)];
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

function randomDate(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  const timestamp =
    start.getTime() +
    random() * (end.getTime() - start.getTime());

  return new Date(timestamp)
    .toISOString()
    .slice(0, 10);
}

function getTodayHavana() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Havana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDateForYear(year) {
  if (year === 2024) {
    return randomDate(
      "2024-01-01",
      "2024-12-31",
    );
  }

  if (year === 2025) {
    return randomDate(
      "2025-01-01",
      "2025-12-31",
    );
  }

  return randomDate(
    "2026-01-01",
    getTodayHavana(),
  );
}

function getRecipientName(index) {
  const names = [
    "María González",
    "Carlos Rodríguez",
    "Ana Pérez",
    "José Martínez",
    "Laura Fernández",
    "Roberto Díaz",
    "Carmen Hernández",
    "Luis García",
    "Marta López",
    "Pedro Sánchez",
    "Elena Ramírez",
    "Jorge Torres",
  ];

  return (
    `${names[index % names.length]} ` +
    `${Math.floor(index / names.length) + 1}`
  );
}

function getRecipientPhone(index) {
  return `535${String(1000000 + index).slice(-7)}`;
}

function buildItems(products) {
  const maxItems = Math.min(
    products.length,
    3,
  );

  /*
   * Aproximadamente 8 % serán pedidos
   * solamente de remesa.
   */
  if (random() < 0.08) {
    return [];
  }

  const itemCount = randomInt(
    1,
    maxItems,
  );

  const selectedProducts = shuffle(products)
    .slice(0, itemCount);

  return selectedProducts.map((product) => ({
    product: product.documentId,
    quantity: randomInt(1, 4),
  }));
}

function buildRemittance() {
  const value = random();

  if (value < 0.35) {
    return 0;
  }

  if (value < 0.70) {
    return randomInt(20, 60);
  }

  if (value < 0.92) {
    return randomInt(61, 120);
  }

  return randomInt(121, 200);
}

function saveSeedData(seedData) {
  fs.writeFileSync(
    SEED_FILE,
    JSON.stringify(seedData, null, 2),
    "utf8",
  );
}

function loadSeedData() {
  if (!fs.existsSync(SEED_FILE)) {
    return {
      orders: [],
    };
  }

  const seedData = JSON.parse(
    fs.readFileSync(SEED_FILE, "utf8"),
  );

  if (!Array.isArray(seedData.orders)) {
    seedData.orders = [];
  }

  return seedData;
}

function countOrdersByYear(seedData) {
  const counters = {
    2024: 0,
    2025: 0,
    2026: 0,
  };

  for (const order of seedData.orders) {
    if (!order.code) {
      continue;
    }

    const match = order.code.match(
      /^[A-Z]{3}-(2024|2025|2026)-/,
    );

    if (!match) {
      continue;
    }

    counters[match[1]]++;
  }

  return counters;
}

function getRemainingTargets(seedData) {
  const current = countOrdersByYear(seedData);

  return {
    2024: Math.max(
      0,
      TARGETS[2024] - current[2024],
    ),
    2025: Math.max(
      0,
      TARGETS[2025] - current[2025],
    ),
    2026: Math.max(
      0,
      TARGETS[2026] - current[2026],
    ),
  };
}

function buildYearQueue(remaining) {
  const queue = [];

  for (
    let i = 0;
    i < remaining[2024];
    i++
  ) {
    queue.push(2024);
  }

  for (
    let i = 0;
    i < remaining[2025];
    i++
  ) {
    queue.push(2025);
  }

  for (
    let i = 0;
    i < remaining[2026];
    i++
  ) {
    queue.push(2026);
  }

  /*
   * Mezclamos los años para que no se creen primero
   * todos los pedidos de 2024, luego 2025, etc.
   */
  return shuffle(queue);
}

async function reconcilePendingCancellations(
  strapi,
  seedData,
) {
  let repaired = 0;

  for (const order of seedData.orders) {
    if (
      order.cancelled !== true ||
      order.cancelledInDatabase === true
    ) {
      continue;
    }

    try {
      await strapi
        .documents("api::order.order")
        .update({
          documentId: order.documentId,
          data: {
            cancelled: true,
          },
        });

      order.cancelledInDatabase = true;
      repaired++;
    } catch (error) {
      console.warn(
        `No se pudo cancelar ${order.code}: ` +
        `${error.message}`,
      );
    }
  }

  if (repaired > 0) {
    saveSeedData(seedData);
  }

  return repaired;
}

async function main() {
  console.log("Iniciando Strapi...");

  const strapi = await createStrapi({
    distDir: path.join(
      PROJECT_ROOT,
      "dist",
    ),
  }).load();

  try {
    const seedData = loadSeedData();

    console.log("");
    console.log(
      "Cargando datos existentes...",
    );

    const salesReps = await strapi
      .documents("api::sales-rep.sales-rep")
      .findMany({
        filters: {
          active: true,
        },
      });

    const customers = await strapi
      .documents("api::customer.customer")
      .findMany();

    const products = await strapi
      .documents("api::product.product")
      .findMany({
        filters: {
          disponible: true,
        },
      });

    console.log(
      `  Vendedoras activas: ${salesReps.length}`,
    );

    console.log(
      `  Clientes:            ${customers.length}`,
    );

    console.log(
      `  Productos:           ${products.length}`,
    );

    if (salesReps.length === 0) {
      throw new Error(
        "No hay vendedoras activas disponibles.",
      );
    }

    if (customers.length === 0) {
      throw new Error(
        "No hay clientes disponibles.",
      );
    }

    if (products.length === 0) {
      throw new Error(
        "No hay productos disponibles.",
      );
    }

    /*
     * Si una ejecución anterior fue interrumpida
     * después de crear un pedido pero antes de marcarlo
     * definitivamente como cancelado, lo corregimos aquí.
     */
    const repairedCancellations =
      await reconcilePendingCancellations(
        strapi,
        seedData,
      );

    if (repairedCancellations > 0) {
      console.log("");
      console.log(
        `Cancelaciones pendientes reparadas: ` +
        `${repairedCancellations}`,
      );
    }

    const currentCounters =
      countOrdersByYear(seedData);

    const remaining =
      getRemainingTargets(seedData);

    const totalRemaining =
      remaining[2024] +
      remaining[2025] +
      remaining[2026];

    console.log("");
    console.log(
      `Pedidos registrados en el archivo: ` +
      `${seedData.orders.length}`,
    );

    console.log("");
    console.log("Situación actual:");

    console.log(
      `  2024: ${currentCounters[2024]} / ${TARGETS[2024]}`,
    );

    console.log(
      `  2025: ${currentCounters[2025]} / ${TARGETS[2025]}`,
    );

    console.log(
      `  2026: ${currentCounters[2026]} / ${TARGETS[2026]}`,
    );

    console.log("");
    console.log("Pendientes de generar:");

    console.log(
      `  2024: ${remaining[2024]}`,
    );

    console.log(
      `  2025: ${remaining[2025]}`,
    );

    console.log(
      `  2026: ${remaining[2026]}`,
    );

    console.log(
      `  Total: ${totalRemaining}`,
    );

    if (totalRemaining === 0) {
      console.log("");
      console.log(
        "Los objetivos de generación ya fueron alcanzados.",
      );

      return;
    }

    const yearQueue =
      buildYearQueue(remaining);

    let createdCount = 0;
    let cancelledCount = 0;

    const executionCounters = {
      2024: 0,
      2025: 0,
      2026: 0,
    };

    console.log("");
    console.log(
      "Comenzando generación...",
    );
    console.log("");

    for (
      let i = 0;
      i < yearQueue.length;
      i++
    ) {
      const year = yearQueue[i];

      const date = getDateForYear(year);

      const salesRep =
        randomItem(salesReps);

      const customer =
        randomItem(customers);

      const items =
        buildItems(products);

      let remittance =
        buildRemittance();

      /*
       * El backend exige que exista al menos
       * un producto o una remesa.
       */
      if (
        items.length === 0 &&
        remittance === 0
      ) {
        remittance = randomInt(
          20,
          100,
        );
      }

      const paymentStatus =
        random() < 0.75
          ? "paid"
          : "pending";

      /*
       * Decidimos la cancelación antes de crear
       * el pedido. Así la intención queda registrada
       * aunque el proceso sea interrumpido.
       */
      const shouldCancel =
        random() < CANCELLATION_RATE;

      const recipientIndex =
        seedData.orders.length;

      const result =
        await strapi
          .service("api::order.order")
          .createOrder({
            date,
            salesRep:
              salesRep.documentId,
            customer:
              customer.documentId,
            recipientName:
              getRecipientName(
                recipientIndex,
              ),
            recipientPhone:
              getRecipientPhone(
                recipientIndex,
              ),
            remittance,
            paymentStatus,
            items,
          });

      /*
       * Registramos inmediatamente el pedido.
       *
       * Si estaba destinado a cancelarse, guardamos
       * esa intención antes de modificar la BD.
       */
      const seedOrder = {
        documentId:
          result.documentId,
        code: result.code,
        cancelled: shouldCancel,
        cancelledInDatabase: false,
      };

      seedData.orders.push(
        seedOrder,
      );

      saveSeedData(seedData);

      /*
       * Si corresponde, lo cancelamos inmediatamente.
       */
      if (shouldCancel) {
        await strapi
          .documents("api::order.order")
          .update({
            documentId:
              result.documentId,
            data: {
              cancelled: true,
            },
          });

        seedOrder.cancelledInDatabase =
          true;

        cancelledCount++;

        saveSeedData(seedData);
      }

      createdCount++;
      executionCounters[year]++;

      console.log(
        `[${createdCount}/${totalRemaining}] ` +
        `${result.code} | ${date} | ` +
        `$${result.total.toFixed(2)} | ` +
        `${paymentStatus === "paid"
          ? "Pagado"
          : "Pendiente"} | ` +
        `${shouldCancel
          ? "CANCELADO"
          : "Activo"}`,
      );
    }

    console.log("");
    console.log(
      "Generación completada correctamente.",
    );

    console.log("");
    console.log(
      "Resumen de esta ejecución:",
    );

    console.log(
      `  2024: ${executionCounters[2024]}`,
    );

    console.log(
      `  2025: ${executionCounters[2025]}`,
    );

    console.log(
      `  2026: ${executionCounters[2026]}`,
    );

    console.log(
      `  Nuevos pedidos: ${createdCount}`,
    );

    console.log(
      `  Cancelados: ${cancelledCount}`,
    );

    const finalCounters =
      countOrdersByYear(seedData);

    console.log("");
    console.log(
      "Total registrado en seed:",
    );

    console.log(
      `  2024: ${finalCounters[2024]}`,
    );

    console.log(
      `  2025: ${finalCounters[2025]}`,
    );

    console.log(
      `  2026: ${finalCounters[2026]}`,
    );

    console.log(
      `  Total: ${seedData.orders.length}`,
    );

    console.log("");
    console.log(
      `Archivo de control: ${SEED_FILE}`,
    );
  } finally {
    console.log("");
    console.log(
      "Cerrando Strapi...",
    );

    try {
      await strapi.destroy();

      console.log(
        "Strapi detenido correctamente.",
      );
    } catch (error) {
      console.warn(
        "Advertencia durante el cierre de Strapi:",
        error.message,
      );
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "ERROR DURANTE LA GENERACIÓN:",
  );
  console.error(error);
  process.exit(1);
});