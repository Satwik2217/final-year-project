import os
import eel
eel.init("www")
os.system(' start msedge --app="http://localhost:8000/index.html" ')   # this line will open my this project in the app format on my pc
eel.start('index.html', mode=None , host='localhost' , block=True )