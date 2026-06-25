import sys
import os

# Add the application directory to the python path so imports resolve correctly
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables from .env file if it exists
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip()

# Import the Flask application and expose it as 'application' for Passenger
from server.app import app as application

