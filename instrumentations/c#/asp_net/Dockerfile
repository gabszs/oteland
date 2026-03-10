FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

COPY ["PasswordApi.csproj", "./"]
RUN dotnet restore "PasswordApi.csproj"

COPY . .
RUN dotnet build "PasswordApi.csproj" -c Release -o /app/build

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/build .

EXPOSE 80
ENTRYPOINT ["dotnet", "PasswordApi.dll"]
