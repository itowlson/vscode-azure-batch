"""
    Biscuits!
"""

import asyncio
import websockets

async def hello(websocket, path):
    """
        Home stuff
    """
    while True:
        name = await websocket.recv()
        print("< {}".format(name))

        if name == ":quit":
            asyncio.get_event_loop().stop()
            break

        greeting = "What ho {}!".format(name)
        await websocket.send(greeting)
        print("> {}".format(greeting))

START_SERVER = websockets.serve(hello, "localhost", 8765)

asyncio.get_event_loop().run_until_complete(START_SERVER)
asyncio.get_event_loop().run_forever()
