module.exports = {
	// Включить
	logging: true,

	// Платформы
	platforms: {
		platform1: {
			name: 'VK',
			config: {
				groupId: 123456789,
				userAgent: "MIEFoudation/Beta (+https://vk.com/@miefoundation-tech)",
				token: "sampletokenforvksampletokenforvksampletokenforvksampletokenforvk"
			}
		},
		platform2: {
			name: 'Discord',
			config: {
				clientId: "123456789012345678",
				guildId: "098765432109876543",
				token: "SampleTokenForDiscord.SampleTokenForDiscord.SampleTokenForDiscord"
			}
		}
	},

	// Настройки чатов
	chats: {
		chat1: {
			platform1: 2000000000 + 1,
			platform2: "123456789012345678"
		},
		chat2: {
			platform1: 2000000000 + 2,
			platform2: "098765432109876543"
		}
	},

	// Настройки хранилища
	storage: {
		// Путь к папке
		path: './.storage/'
	}
}