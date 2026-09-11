# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files for restore
COPY HamptonHawksPlantSales.sln .
COPY src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj src/HamptonHawksPlantSales.Api/
COPY src/HamptonHawksPlantSales.Core/HamptonHawksPlantSales.Core.csproj src/HamptonHawksPlantSales.Core/
COPY src/HamptonHawksPlantSales.Infrastructure/HamptonHawksPlantSales.Infrastructure.csproj src/HamptonHawksPlantSales.Infrastructure/
COPY tests/HamptonHawksPlantSales.Tests/HamptonHawksPlantSales.Tests.csproj tests/HamptonHawksPlantSales.Tests/
# Every project in the .sln must be present here, or the restore below fails.
COPY tests/HamptonHawksPlantSales.PostgresTests/HamptonHawksPlantSales.PostgresTests.csproj tests/HamptonHawksPlantSales.PostgresTests/

RUN dotnet restore

# Copy everything and build
COPY . .
RUN dotnet publish src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
# The healthcheck in docker-compose.yml and docker-compose.portainer.yml runs
# `wget`, which this base image does not ship. Without it the check fails with
# "wget: not found" every time, so the API is reported unhealthy even while it
# is serving requests (found by CI's compose job).
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "HamptonHawksPlantSales.Api.dll"]
