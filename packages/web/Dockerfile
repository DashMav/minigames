FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
ENV NEXT_PUBLIC_AUTH_URL=http://localhost:30001
ENV NEXT_PUBLIC_GAME_URL=http://localhost:30002
ENV NEXT_PUBLIC_CHAT_URL=http://localhost:30003
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]