import sys
import os

# Add the application directory to the python path so imports resolve correctly
sys.path.insert(0, os.path.dirname(__file__))

# Import the Flask application and expose it as 'application' for Passenger
from server.app import app as application
