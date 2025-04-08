require("dotenv").config();
const { Telegraf } = require("telegraf");
const db = require("./firebase.js");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userStates = {};
const channelId = "@julostandfound";

// Helper function to show main menu
function showMainMenu(ctx) {
  return ctx.reply("Choose an option:", {
    reply_markup: {
      keyboard: [
        [{ text: "Report Lost Item" }],
        [{ text: "Report Found Item" }],
        //  [{ text: "Browse Items" }],
      ],
      resize_keyboard: true,
    },
  });
}

// Function to notify ID owner
async function notifyIdOwner(idNumber, finderName, finderContact) {
  try {
    const usersSnapshot = await db
      .collection("users")
      .where("idNumber", "==", idNumber)
      .get();

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.telegramId) {
        await bot.telegram.sendMessage(
          userData.telegramId,
          `🎉 Good news! Your lost ID has been found!\n\n` +
            `Found by: ${finderName}\n` +
            `Contact: ${finderContact}\n\n` +
            `Please contact them to arrange retrieval.`
        );
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error notifying ID owner:", error);
    return false;
  }
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const userSnapshot = await db
    .collection("users")
    .doc(userId.toString())
    .get();

  if (!userSnapshot.exists) {
    ctx.reply("Welcome! Please enter your full name:");
    userStates[userId] = { step: "name" };
  } else {
    showMainMenu(ctx);
  }
});

bot.help((ctx) => {
  ctx.reply(
    "This bot is developed by \n Amenadam Solomon \n Freshman Student in JIT"
  );
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates[userId];
  const text = ctx.message.text;

  console.log(`User ${userId} state:`, userState);

  // Registration flow
  if (userState?.step === "name") {
    userStates[userId] = { name: text, step: "phone" };
    return ctx.reply("Please enter your phone number:");
  }

  if (userState?.step === "phone") {
    userStates[userId].phoneNumber = text;
    userStates[userId].step = "id";
    return ctx.reply("Please enter your ID number:");
  }

  if (userState?.step === "id") {
    const { name, phoneNumber } = userStates[userId];

    await db.collection("users").doc(userId.toString()).set({
      name,
      phoneNumber,
      idNumber: text,
      telegramId: userId,
    });

    delete userStates[userId];
    return showMainMenu(ctx);
  }

  // Main menu options
  if (text === "Report Lost Item" || text === "Report Found Item") {
    const itemType = text.includes("Lost") ? "lost" : "found";
    userStates[userId] = { step: "ask_item_type", itemType };

    return ctx.reply("Is this item an ID?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Yes", callback_data: "item_type_yes" }],
          [{ text: "No", callback_data: "item_type_no" }],
        ],
      },
    });
  }

  if (text === "Browse Items") {
    const itemsSnapshot = await db.collection("items").get();
    if (itemsSnapshot.empty) {
      return ctx.reply("No items reported yet.");
    }

    let itemsList = "Recent items:\n\n";
    itemsSnapshot.forEach((doc) => {
      const item = doc.data();
      itemsList += `Type: ${item.type}\nDescription: ${
        item.description || "ID: " + item.idNumber
      }\n\n`;
    });
    return ctx.reply(itemsList);
  }

  // Item reporting flows
  if (userState?.step === "report_id_number") {
    const idNumber = text;
    const userDoc = await db.collection("users").doc(userId.toString()).get();
    const userData = userDoc.data();

    const report = {
      type: userState.itemType,
      idNumber,
      userId,
      timestamp: new Date(),
    };

    await db.collection("items").add(report);

    const message =
      `📢 ${userState.itemType === "lost" ? "LOST" : "FOUND"} ID\n` +
      `👤 Name: ${userData.name}\n` +
      `📞 Phone: ${userData.phoneNumber}\n` +
      `🆔 ID Number: ${idNumber}`;

    await bot.telegram.sendMessage(channelId, message);

    // If it's a found ID, try to notify the owner
    if (userState.itemType === "found") {
      const ownerNotified = await notifyIdOwner(
        idNumber,
        userData.name,
        userData.phoneNumber
      );

      if (ownerNotified) {
        await ctx.reply("The ID owner has been notified!");
      } else {
        await ctx.reply(
          "We couldn't find the ID owner in our system. The report has been posted to the channel."
        );
      }
    } else {
      await ctx.reply("Your lost ID has been reported to the channel.");
    }

    delete userStates[userId];
    return showMainMenu(ctx);
  }

  if (userState?.step === "report_description") {
    const description = text;
    const userDoc = await db.collection("users").doc(userId.toString()).get();
    const userData = userDoc.data();

    const report = {
      type: userState.itemType,
      description,
      userId,
      timestamp: new Date(),
    };

    await db.collection("items").add(report);

    const message =
      `📢 ${userState.itemType === "lost" ? "LOST" : "FOUND"} ITEM\n` +
      `👤 Name: ${userData.name}\n` +
      `📞 Phone: ${userData.phoneNumber}\n` +
      `📝 Description: ${description}`;

    await bot.telegram.sendMessage(channelId, message);
    ctx.reply(
      `Your ${userState.itemType} item has been reported to the channel.`
    );
    delete userStates[userId];
    return showMainMenu(ctx);
  }
});

bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates[userId];
  const caption = ctx.message.caption || "";

  if (userState?.step === "report_description") {
    const photo = ctx.message.photo[0];
    const fileId = photo.file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);

    const userDoc = await db.collection("users").doc(userId.toString()).get();
    const userData = userDoc.data();

    const report = {
      type: userState.itemType,
      description: caption,
      photoUrl: fileLink.href,
      userId,
      timestamp: new Date(),
    };

    await db.collection("items").add(report);

    await bot.telegram.sendPhoto(channelId, fileId, {
      caption:
        `📢 ${userState.itemType === "lost" ? "LOST" : "FOUND"} ITEM\n` +
        `👤 Name: ${userData.name}\n` +
        `📞 Phone: ${userData.phoneNumber}\n` +
        `📝 Description: ${caption || "No description provided"}`,
    });

    ctx.reply(
      `Your ${userState.itemType} item with photo has been reported to the channel.`
    );
    delete userStates[userId];
    return showMainMenu(ctx);
  }
});

bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  if (data === "item_type_yes") {
    userStates[userId].step = "report_id_number";
    ctx.reply("Please enter the ID number:");
  } else if (data === "item_type_no") {
    userStates[userId].step = "report_description";
    ctx.reply(
      "Please describe the item (you can send text or a photo with description):"
    );
  }

  await ctx.answerCbQuery();
});

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  ctx.reply("An error occurred. Please try again.");
});

bot.launch();
console.log("Bot started");
