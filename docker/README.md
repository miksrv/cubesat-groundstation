# Docker Configuration

This directory contains Docker-related configuration files for the CubeSat Ground Station project.

## MySQL Database

The project uses MySQL 8.0 running in a Docker container for development and testing.

### Directory Structure

```
docker/
└── mysql/
    └── init.sql          # Initialization script (runs on first start)
```

### docker-compose.yml

Located in project root. Defines:
- Service name: `cubesat`
- Container name: `cubesat`
- Volume name: `cubesat`
- Project name: `database`

### init.sql

This SQL script runs automatically when the MySQL container starts for the first time. It:
- Grants privileges to `cubesat_user`
- Creates test database `cubesat_groundstation_test`
- Sets timezone to UTC
- Prepares the environment for CodeIgniter migrations

### Starting MySQL

From project root:
```bash
docker compose up -d
```

### Stopping MySQL

```bash
docker compose down
```

### Reset Database

To completely reset the database (WARNING: deletes all data):
```bash
docker compose down -v
docker compose up -d
```

### Accessing MySQL CLI

```bash
docker compose exec cubesat mysql -uroot -prootpassword cubesat_groundstation
```

### Connection Details

- **Host:** localhost
- **Port:** 3306
- **Database:** cubesat_groundstation
- **User:** cubesat_user
- **Password:** cubesat_password
- **Root Password:** rootpassword

### Data Persistence

MySQL data is stored in Docker volume `cubesat` and persists between container restarts.

### Logs

View MySQL logs:
```bash
docker compose logs -f cubesat
```

### Container Management

```bash
# Check status
docker compose ps

# Restart container
docker compose restart cubesat

# Check health
docker compose exec cubesat mysqladmin -uroot -prootpassword ping
```

## Notes

- The MySQL container uses `mysql_native_password` authentication plugin for compatibility
- Healthcheck ensures database is ready before accepting connections
- Container restarts automatically with `restart: always`
- Port 3306 is exposed to host for direct access
- Volume name `cubesat` matches container naming convention

