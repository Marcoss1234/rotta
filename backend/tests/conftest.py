import sys
from pathlib import Path

# Permite lanzar las pruebas desde cualquier carpeta del proyecto.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
