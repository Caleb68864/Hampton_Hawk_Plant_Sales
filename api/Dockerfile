# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files for restore
COPY HamptonHawksPlantSales.sln .
COPY src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj src/HamptonHawksPlantSales.Api/
COPY src/HamptonHawksPlantSales.Core/HamptonHawksPlantSales.Core.csproj src/HamptonHawksPlantSales.Core/
COPY src/HamptonHawksPlantSales.Infrastructure/HamptonHawksPlantSales.Infrastructure.csproj src/HamptonHawksPlantSales.Infrastructure/
COPY tests/HamptonHawksPlantSales.Tests/HamptonHawksPlantSales.Tests.csproj tests/HamptonHawksPlantSales.Tests/

RUN dotnet restore

# Copy everything and build
COPY . .
RUN dotnet publish src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "HamptonHawksPlantSales.Api.dll"]
