"""Coloca a pasta backend/ no sys.path para os testes."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
