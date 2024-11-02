module.exports = {
  apps: [
    {
      "name": "saludtotal_1",
      "script": "/home/devbots/supervisor/saludtotal_.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "saludtotal_2",
      "script": "/home/devbots/supervisor/saludtotal_.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "sura_1",
      "script": "/home/devbots/supervisor/sura_.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "sura_2",
      "script": "/home/devbots/supervisor/sura_.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "nuevaeps_1",
      "script": "/home/devbots/supervisor/nuevaeps_.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "nuevaeps_2",
      "script": "/home/devbots/supervisor/nuevaeps_.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "profamilia_1",
      "script": "/home/devbots/supervisor/profamilia_1.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "profamilia_2",
      "script": "/home/devbots/supervisor/profamilia_2.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "profamilia_validacion_1",
      "script": "/home/devbots/supervisor/run_agendamiento.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "profamilia_validacion_2",
      "script": "/home/devbots/supervisor/run_agendamiento.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_sura_1",
      "script": "/home/devbots/supervisor/agendamiento_sura.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_sura_2",
      "script": "/home/devbots/supervisor/agendamiento_sura.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_nuevaeps_1",
      "script": "/home/devbots/supervisor/agendamiento_nuevaeps.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_nuevaeps_2",
      "script": "/home/devbots/supervisor/agendamiento_nuevaeps.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_saludtotal_1",
      "script": "/home/devbots/supervisor/agendamiento_saludtotal.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_saludtotal_2",
      "script": "/home/devbots/supervisor/agendamiento_saludtotal.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_famisanar_1",
      "script": "/home/devbots/supervisor/agendamiento_famisanar.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_famisanar_2",
      "script": "/home/devbots/supervisor/agendamiento_famisanar.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_asmetsalud_1",
      "script": "/home/devbots/supervisor/agendamiento_asmetsalud.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "agendamiento_asmetsalud_2",
      "script": "/home/devbots/supervisor/agendamiento_asmetsalud.sh",
      "interpreter": "/bin/bash",
      "args": ["2"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "delete_1",
      "script": "/home/devbots/supervisor/delete_.sh",
      "interpreter": "/bin/bash",
      "args": ["1"], 
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 5000,
      "env": {
        "NODE_ENV": "production"
      }
    }
  ]
};