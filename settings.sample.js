// You can use any JavaScript here
// and then export settings with module.exports

module.exports = {
  // Log every action with messages to console
  logging: false,

  // Do not exit on error
  failsafe: true,

  // Platform settings
  platforms: {
    // User-defined platform ID
    platform1: {
      // Name of platform to use
      name: 'VK',
      // Config of platform (varies)
      config: {
        groupId: 123456789, // Optional
        // userAgent: 'Custom user agent'
        token: 'SampleUserTokenToVKSampleUserTokenToVKSampleUserTokenToVKSampleUserTokenToVK'
      }
    },
    platform2: {
      name: 'Discord',
      config: {
        clientId: '123456789012345678',
        guildId: '098765432109876543',
        token: 'SampleTokenForDiscordBot.SampleTokenForDiscordBot.SampleTokenForDiscordBot'
      }
    }
  },

  // Chat settings
  chats: {
    // User-defined chat ID
    chat1: {
      // Platform ID (defined above) mapped to chat
      platform1: 2000000000 + 1,
      platform2: '123456789012345678'
    },
    chat2: {
      platform1: 2000000000 + 2,
      platform2: '098765432109876543'
    }
  },

  // Storage settings
  storage: {
    // Do not write anything to disk
    // Turn on if you know what are you doing
    // Default = false
    cacheOnly: false,
    // Otherwise, write message IDs to file
    // Message contents are NOT stored
    // Default = '.storage'
    path: '.storage',
    // Cleanup old messages from storage and write
    // everything else to disk every N seconds
    // (Messages are considered old after 24 hours)
    // Default = 60 * 10
    saveInterval: 60 * 60
  }
}
