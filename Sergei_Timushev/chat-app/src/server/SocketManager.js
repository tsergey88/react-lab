const io = require('./index.js').io;

const {
  VERIFY_USER,
  USER_CONNECTED,
  USER_DISCONNECTED,
  LOGOUT,
  COMMUNITY_CHAT,
  MESSAGE_RECIEVED,
  MESSAGE_SENT,
  TYPING,
  PRIVATE_MESSAGE,
  NEW_CHAT_USER,
} = require('../Events');

const { createUser, createMessage, createChat } = require('../Factories');

let connectedUser = {};
let communityChat = createChat({ isCommunity: true });

module.exports = (socket) => {
  console.log('Socket ID ' + socket.id);

  let sendMessageToChatFromUser;
  let sendTypingFromUser;

  socket.on(VERIFY_USER, (nickname, callback) => {
    if (isUser(connectedUser, nickname)) {
      callback({
        isUser: true,
        user: null,
      })
    } else {
      callback({ isUser:false, user:createUser({ name:nickname, socketId:socket.id }) });
    }
  });

  socket.on(USER_CONNECTED, (user) => {
    user.socketId = socket.id;
    connectedUser = addUser(connectedUser, user);
    socket.user = user;
    sendMessageToChatFromUser = sendMessageToChat(user.name);
    sendTypingFromUser = sendTypingToChat(user.name);
    io.emit(USER_CONNECTED, connectedUser);
    console.log(connectedUser);
  });

  socket.on('disconnect', () => {
    if ('user' in socket) {
      connectedUser = removeUser(connectedUser, socket.user.name);
      io.emit(USER_DISCONNECTED, connectedUser);
      console.log('disconnect', connectedUser);
    }
  });

  socket.on(LOGOUT, () => {
    connectedUser = removeUser(connectedUser, socket.user.name);
    io.emit(USER_DISCONNECTED, connectedUser);
    console.log('disconnect', connectedUser);
  });

  socket.on(COMMUNITY_CHAT, (callback) => {
    callback(communityChat);
  });

  socket.on(MESSAGE_SENT, ({ chatId, message }) => {
    sendMessageToChatFromUser(chatId, message);
  });

  socket.on(TYPING, ({ chatId, isTyping }) => {
    sendTypingFromUser(chatId, isTyping);
  });

  socket.on(PRIVATE_MESSAGE, ({ reciever, sender, activeChat }) => {
    if(reciever in connectedUser) {
      const recieverSocket = connectedUser[reciever].socketId;
      if(activeChat === null || activeChat.id === communityChat.id){
        const newChat = createChat({ name:`${ reciever }&${ sender }`, users:[reciever, sender] });        
        socket.to(recieverSocket).emit(PRIVATE_MESSAGE, newChat);
        socket.emit(PRIVATE_MESSAGE, newChat);
      } else {
        if(!(reciever in activeChat.users)) {
          activeChat.users
                    .filter(user => user in connectedUser)
                    .map(user => connectedUser[user])
                    .map(user => {
                      socket.to(user.socketId).emit(NEW_CHAT_USER, { chatId: activeChat, newUser: reciever });
                    });
          socket.emit(NEW_CHAT_USER, { chatId: activeChat.id, newUser: reciever});
        }
        socket.to(recieverSocket).emit(PRIVATE_MESSAGE, activeChat);
      }
    }
  })

}

const sendTypingToChat = (user) => {
  return (chatId, isTyping) => {
    io.emit(`${ TYPING }-${ chatId }`, { user, isTyping });
  }
}

const sendMessageToChat = (sender) => {
  return (chatId, message) => {
    io.emit(`${ MESSAGE_RECIEVED }-${ chatId }`, createMessage({ message, sender }))
  }
}

const addUser = (userList, user) => {
  let newList = Object.assign({}, userList);
  newList[user.name] = user;
  return newList;
}

const removeUser = (userList, username) => {
  let newList = Object.assign({}, userList);
  delete newList[username];
  return newList;
}

const isUser = (userList, username) => {
  return username in userList;
}