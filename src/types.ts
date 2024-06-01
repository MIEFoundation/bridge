///
/// Worker options
///

export namespace Options {
  export namespace Workers {
    export interface Common {
      mainQueueName: string
      redisClientUrl?: string
    }
    export interface MainWorker extends Common {
      databaseName: string
      databaseClientUrl?: string
    }
    export interface PlatformWorker extends Common {
      serviceName: string
      platformOptions: any
    }
  }

  export enum PlatformMode {
    monolith,
    dualWorker,
    byPlatform,
    byService,
  }
  export interface Application {
    mode: PlatformMode,
    services: Record<string, {
      platform: string
      accessToken: string,
      options: any
    }>
    rooms: {
      name: string,
      platform: {
        service: keyof Application['services'],
        roomId: string
      }[]
    }[]
  }
}

///
/// RichMessage and its components
///

export namespace RichMessage {
  interface Sender {
    accountURI: string
    displayName: string
    url?: string
  }
  type MessageOptional = Pick<Message, 'id'> & Partial<Message>
  interface Attachment {
    type: 'image' | 'file'
    url: string
  }
  export interface Content {
    sender: Sender
    text?: string
    reply?: MessageOptional
    attachments?: Attachment[]
  }
  export interface Destination {
    service: string
    roomId: string
  }
  export interface SourceID extends Destination {
    messageId: string
  }
  export interface DestinationID extends SourceID {
    additionals?: string[]
  }
  export interface Message extends Content {
    id: string
    source: SourceID
    destinations: DestinationID[]
  }
}

///
/// Job types
///

export namespace Jobs {
  export namespace DatabaseSaveMessage {
    export type Data = OnNewMessage.Data
    export type Children = MessageCreate.Result[]
    export type Result = void
    export const Name = 'DatabaseSaveMessage'
  }
  export namespace DatabaseUpdateMessage {
    export interface Data {
      source: RichMessage.SourceID
      content: RichMessage.Content
    }
    export type Children = MessageCreate.Result[]
    export type Result = void
    export const Name = 'DatabaseUpdateMessage'
  }
  export namespace DatabaseRemoveMessage {
    export interface Data {
      source: RichMessage.SourceID
      content: RichMessage.Content
    }
    export type Children = MessageCreate.Result[]
    export type Result = void
    export const Name = 'DatabaseSaveMessage'
  }

  export namespace OnNewMessage {
    export interface Data {
      source: RichMessage.SourceID
      content: RichMessage.Content
    }
    export type Result = void
    export const Name = 'OnNewMessage'
  }

  export namespace OnUpdatedMessage {
    export interface Data {
      source: OnNewMessage.Data['source']
      newContent: OnNewMessage.Data['content']
    }
    export type Result = void
    export const Name = 'OnUpdatedMessage'
  }

  export namespace OnRemovedMessage {
    export type Data = OnNewMessage.Data['source']
    export type Result = void
    export const Name = 'OnRemovedMessage'
  }

  export namespace MessageCreate {
    export interface Data {
      dest: RichMessage.Destination
      content: OnNewMessage.Data['content']
    }
    export type Result = RichMessage.DestinationID
    export const Name = 'MessageCreate'
  }

  export namespace MessageUpdate {
    export interface Data {
      destId: MessageCreate.Result
      oldContent: RichMessage.Content
      newContent: OnUpdatedMessage.Data['newContent']
    }
    export type Result = MessageCreate.Result
    export const Name = 'MessageUpdate'
  }

  export namespace MessageRemove {
    export type Data = MessageCreate.Result
    export type Result = void
    export const Name = 'MessageRemove'
  }

  export type DataTypeActions = MessageCreate.Data | MessageUpdate.Data | MessageRemove.Data
  export type DataResultActions = MessageCreate.Result | MessageUpdate.Result | MessageRemove.Result
  export type DataNameActions = typeof MessageCreate.Name | typeof MessageUpdate.Name | typeof MessageRemove.Name

  export type DataTypeEvents = OnNewMessage.Data | OnUpdatedMessage.Data | OnRemovedMessage.Data
  export type DataResultEvents = OnNewMessage.Result | OnUpdatedMessage.Result | OnRemovedMessage.Result
  export type DataNameEvents = typeof OnNewMessage.Name | typeof OnUpdatedMessage.Name | typeof OnRemovedMessage.Name

  export type DataTypeDatabase = DatabaseSaveMessage.Data | DatabaseUpdateMessage.Data | DatabaseRemoveMessage.Data
  export type DataResultDatabase = DatabaseSaveMessage.Result | DatabaseUpdateMessage.Result | DatabaseRemoveMessage.Result
  export type DataNameDatabase = typeof DatabaseSaveMessage.Name | typeof DatabaseUpdateMessage.Name | typeof DatabaseRemoveMessage.Name

  export type DataTypeAll = DataTypeEvents | DataTypeDatabase
  export type DataResultAll = DataResultEvents | DataResultDatabase
  export type DataNameAll = DataNameEvents | DataNameDatabase
}

