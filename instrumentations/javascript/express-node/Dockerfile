# Use a imagem oficial do Node.js como base
FROM node:20-slim

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependências
COPY package.json pnpm-lock.yaml* ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos da aplicação
COPY . .

# Expõe a porta que a aplicação utiliza
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "server.js"]
