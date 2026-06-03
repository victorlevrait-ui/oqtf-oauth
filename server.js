require("dotenv").config();
const express = require("express");
const fetch   = require("node-fetch");

const app = express();

const {
  DISCORD_CLIENT_ID     = "1511668420859531376",
  DISCORD_CLIENT_SECRET,
  DISCORD_WEBHOOK_URL,
  REDIRECT_URI          = "https://oqtfshop.up.railway.app/callback",
  SHOP_URL              = "https://oqtf.sellauth.com",
  BAN_LIST              = "",
} = process.env;

// ── Health check ──
app.get("/", (req, res) => res.send("✅ OQTF Shop OAuth — En ligne"));

// ── 1. Redirige vers Discord OAuth ──
app.get("/discord-login", (req, res) => {
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         "identify",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// ── 2. Callback OAuth ──
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(SHOP_URL);

  try {
    // Échange le code contre un token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Token invalide");

    // Récupère les infos Discord
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    const userId   = user.id;
    const username = user.username;
    const tag      = user.discriminator && user.discriminator !== "0"
                       ? `${username}#${user.discriminator}`
                       : username;
    const avatar   = user.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;
    const time     = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

    // Vérifie le ban
    const banned   = BAN_LIST.split(",").map(s => s.trim()).filter(Boolean);
    const isBanned = banned.includes(userId);

    // Log webhook Discord
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username:   "OQTF Shop — Login",
        avatar_url: "https://media.discordapp.net/attachments/1479540086839443599/1484609515360878593/j9svhpb.png",
        embeds: [{
          color: isBanned ? 0xff0000 : 0x5865F2,
          title: isBanned
            ? "🚫 TENTATIVE DE CONNEXION — COMPTE BANNI"
            : "✅ Nouvelle connexion Discord",
          thumbnail: { url: avatar },
          fields: [
            { name: "👤 Pseudo",  value: `\`${tag}\``,                        inline: true },
            { name: "🆔 ID",      value: `\`${userId}\``,                     inline: true },
            { name: "🕐 Heure",   value: `\`${time}\``,                       inline: true },
            { name: "🚫 Banni ?", value: isBanned ? "**OUI 🔴**" : "Non ✅",  inline: true },
          ],
          footer: { text: "OQTF Shop — Discord OAuth" },
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    // ── Redirige vers le shop avec les paramètres ──
    const redirectUrl = new URL(SHOP_URL);

    if (isBanned) {
      redirectUrl.searchParams.set("discord_banned", "1");
      redirectUrl.searchParams.set("discord_id",     userId);
    } else {
      redirectUrl.searchParams.set("discord_user",   username);
      redirectUrl.searchParams.set("discord_avatar", avatar);
      redirectUrl.searchParams.set("discord_id",     userId);
    }

    res.redirect(redirectUrl.toString());

  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect(SHOP_URL);
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Serveur OAuth démarré sur le port", process.env.PORT || 3000)
);
