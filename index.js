require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
  Partials 
} = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const PREFIX = '.';

const COMMANDS = {
  sex: {
    title: 'Sex',
    sources: [
      () => fetchPurr('fuck'),
      () => fetchPurr('anal'),
      () => fetchPurr('blowjob')
    ]
  },
  anal: {
    title: 'Anal',
    sources: [
      () => fetchPurr('anal')
    ]
  },
  blowjob: {
    title: 'Blowjob',
    sources: [
      () => fetchPurr('blowjob')
    ]
  },
  hentai: {
    title: 'Hentai',
    sources: [
      () => fetchPurr('neko'),
      () => fetchPurr('fuck'),
      () => fetchPurr('anal')
    ]
  },
  doggystyle: {
    title: 'Doggystyle',
    sources: [
      () => fetchPurr('fuck'),
      () => fetchPurr('anal')
    ]
  }
};

async function fetchPurr(category) {
  try {
    const res = await axios.get(`https://api.purrbot.site/v2/img/nsfw/${category}/gif`, {
      timeout: 10000
    });
    if (res.data?.link) {
      return res.data.link;
    }
  } catch (e) {
    console.error(`PurrBot error (${category}):`, e.message);
  }
  return null;
}

async function getRandomMedia(command) {
  const cmd = COMMANDS[command];
  if (!cmd) return null;

  const sources = [...cmd.sources].sort(() => Math.random() - 0.5);

  for (const source of sources) {
    const url = await source();
    if (url) return { url, title: cmd.title };
  }
  return null;
}

async function sendMedia(channel, media, requester) {
  try {
    // Download the GIF first
    const response = await axios.get(media.url, {
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const buffer = Buffer.from(response.data);
    const attachment = new AttachmentBuilder(buffer, { name: 'nsfw.gif' });

    const embed = new EmbedBuilder()
      .setColor(0xff0066)
      .setTitle(media.title)
      .setImage('attachment://nsfw.gif')
      .setFooter({ text: `Requested by ${requester}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('load_more')
        .setLabel('Load More')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄')
    );

    return await channel.send({
      embeds: [embed],
      files: [attachment],
      components: [row]
    });
  } catch (err) {
    console.error('Send media error:', err.message);
    // fallback: send link only
    const embed = new EmbedBuilder()
      .setColor(0xff0066)
      .setTitle(media.title)
      .setDescription(`[Click to view](${media.url})`)
      .setFooter({ text: `Requested by ${requester}` });

    return await channel.send({ embeds: [embed] });
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('NSFW | .sex .anal .blowjob .hentai .doggystyle', { type: 3 });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  if (message.guild && !message.channel.nsfw) {
    return message.reply('⚠️ This command only works in **NSFW channels**.');
  }

  const args = message.content.slice(PREFIX.length).trim().toLowerCase().split(/ +/);
  const command = args[0];

  if (!COMMANDS[command]) return;

  try {
    await message.channel.sendTyping();

    const media = await getRandomMedia(command);
    if (!media) {
      return message.reply('Failed to fetch media. Try again.');
    }

    const sentMessage = await sendMedia(message.channel, media, message.author.username);

    // Collector for Load More
    const collector = sentMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 180_000
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId !== 'load_more') return;

      await interaction.deferUpdate();

      const newMedia = await getRandomMedia(command);
      if (!newMedia) {
        return interaction.followUp({ content: 'Failed to load more.', ephemeral: true });
      }

      // BAGONG MESSAGE every click
      await sendMedia(message.channel, newMedia, message.author.username);
    });

    collector.on('end', async () => {
      try {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('load_more')
            .setLabel('Load More')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
            .setDisabled(true)
        );
        await sentMessage.edit({ components: [disabledRow] });
      } catch (e) {}
    });

  } catch (err) {
    console.error(err);
    message.reply('Something went wrong while fetching.');
  }
});

client.login(process.env.TOKEN);
