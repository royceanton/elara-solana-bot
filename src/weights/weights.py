import pandas as pd 
import numpy as np 
import matplotlib.pyplot as plt
import seaborn as sns
import os
import sys

import requests
import cvxpy as cp

import time
import traceback
import json
from datetime import datetime, timedelta
from tabulate import tabulate


def fetch_pool_data(query, network, include=None, page=1):
    # Define the base URL
    base_url = "https://api.geckoterminal.com/api/v2/search/pools"

    # Define the query parameters
    params = {
        'query': query,
        'network': network,
        'page': page
    }

    # Add the 'include' parameter if it was provided
    if include is not None:
        params['include'] = include

    # Make the HTTP request
    response = requests.get(base_url, params=params)

    # Check for a successful response
    if response.status_code != 200:
        raise Exception(f"API request failed with status code {response.status_code}")

    # Parse the JSON response and extract the 'data' data
    data = response.json()['data']

    # Prepare a list to store the data for the DataFrame
    df_data = []

    # Loop through each item in the data
    for item in data:
        # Extract the attributes
        attributes = item['attributes']

        # Prepare a dictionary to store the data for this row
        row = {
            'id': item['id'],
            'address': attributes['address'],
            'name': attributes['name'],
            'fdv_usd': attributes['fdv_usd'],
            'market_cap_usd': attributes['market_cap_usd'],
        }

        # Add the row to the list of data for the DataFrame
        df_data.append(row)

    # Convert the data to a pandas DataFrame
    df = pd.DataFrame(df_data)

    return df

def fetch_ohlc_data(network, pool_address, timeframe, aggregate=1, before_timestamp=None, limit=1000):
    # Define the base URL
    base_url = "https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}"

    # Format the URL with the provided parameters
    url = base_url.format(network=network, pool_address=pool_address, timeframe=timeframe)

    # Define the query parameters
    params = {
        'aggregate': aggregate,
        'limit': limit
    }

    # Add the 'before_timestamp' parameter if it was provided
    if before_timestamp is not None:
        params['before_timestamp'] = before_timestamp

    # Make the HTTP request
    response = requests.get(url, params=params)

    # Check for a successful response
    if response.status_code != 200:
        raise Exception(f"API request failed with status code {response.status_code}")

    # Parse the JSON response and extract the 'ohlcv_list' data
    data = response.json()['data']['attributes']['ohlcv_list']

    # Convert the data to a pandas DataFrame
    df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    
    # Convert timestamp to datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
    
    #sort by timestamp
    df = df.sort_values(by=['timestamp']).reset_index(drop=True)

    return df


def Follow_The_Quadratized_Leader_weights(r,df,epsilon=0):
  T = r.shape[0]
  n = r.shape[1]
  if T==0:
    return pd.DataFrame(np.ones((1, n))/n, columns=df.columns)
  
  x = np.zeros((T,n))
  x_t_plus_1 = np.ones(n)/n
  b_t = 0
  A_t=1e-3*np.eye(n)
  for t in range(T):
    x[t] = x_t_plus_1

    A_t += np.outer(r[t],r[t])/np.dot(r[t],x[t])
    b_t += -r[t]/np.dot(r[t],x[t]) - r[t]

    var_x = cp.Variable(n)
    

    obj = 0.5* cp.quad_form(var_x,  A_t) + b_t.T@var_x + epsilon * 0.5 * cp.sum_squares(var_x)
    prob = cp.Problem(cp.Minimize(obj), [cp.sum(var_x) == 1, var_x >= 0])
    prob.solve()
    x_t_plus_1 = var_x.value

  return pd.DataFrame(x, columns=df.columns, index=df.index)


def main(output_dir):
    # Initialize a DataFrame to store all the data
    merged_df = None 

    # Set parameters
    aggregate = 1
    timeframe = 'hour'
    network = 'solana'
    
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.realpath(__file__))

    # Get the path to the JSON file
    json_file_path = os.path.join(script_dir, '../../whitelist.json')

    # Load symbols from the JSON file
    with open(json_file_path, 'r') as f:
        symbols = json.load(f)

    # Filter out 'WSOL' and 'USDC' from the symbols
    filtered_symbols = [symbol for symbol in symbols if symbol not in ['WSOL', 'USDC']]

    # Copy the filtered symbols
    symbols = filtered_symbols.copy()

    # Fetch data for each symbol and save it to a CSV file
    for symbol in symbols:
        token_df = fetch_pool_data(query=symbol, network=network, include='base_token,quote_token', page=1)
        pool_address = token_df['address'].iloc[0]
        pair_name = token_df['name'].iloc[0]

        df = fetch_ohlc_data(network, pool_address, timeframe, aggregate=aggregate, before_timestamp=None, limit=1000)
        df['pair'] = pair_name

        directory = os.path.join(script_dir, f"assets/{network}/{symbol}")
        os.makedirs(directory, exist_ok=True)

        df.to_csv(f'{directory}/{symbol}_{aggregate}{timeframe}.csv', index=False)

    # Load the saved data and merge it into one DataFrame
    for symbol in symbols:
        try:  
            file_path = os.path.join(script_dir, f'assets/solana/{symbol}/{symbol}_{aggregate}{timeframe}.csv')  
            df = pd.read_csv(file_path)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.set_index('timestamp')
            symbol = df['pair'].iloc[0].replace(' ', '').replace('/', '-')
            df = df[['close']].rename(columns={'close': symbol})

            if merged_df is None:
                merged_df = df
            else:
                merged_df = pd.merge(merged_df, df, left_index=True, right_index=True, how='outer')

        except Exception as e:
            print(f'No data or error for {symbol}: {str(e)}')
            continue

    # Process the merged data
    if merged_df is not None:
        merged_df.reset_index(inplace=True)
        merged_df.dropna(inplace=True)
        merged_df.set_index('timestamp', inplace=True)
        merged_df['USDC'] = 1.0

        df = 1+merged_df.pct_change().dropna()/100
        r = df.to_numpy()
        df = df.cumprod(axis=0)
        
        weights_df = Follow_The_Quadratized_Leader_weights(r,df, epsilon=0)
        weights_df = weights_df.round(3).abs()
        weights_df.columns = [name.split('-')[0] for name in weights_df.columns]

        # Calculate changes in weights
        if len(weights_df) >= 2:
            changes = weights_df.iloc[-1] - weights_df.iloc[-2]
            assets_to_buy = changes[changes > 0].round(3)
            assets_to_sell = changes[changes < 0].abs().round(3)
        else:
            print("weights_df has less than 2 rows. Skipping this iteration.")

        # Convert the changes to lists of dictionaries
        assets_to_buy_list = [{'symbol': symbol, 'weight': weight} for symbol, weight in assets_to_buy.items()]
        assets_to_sell_list = [{'symbol': symbol, 'weight': weight} for symbol, weight in assets_to_sell.items()]

        # Save the lists to JSON files
        weight_results_dir = os.path.join(script_dir, 'weightResults')
        os.makedirs(weight_results_dir, exist_ok=True)

        with open(os.path.join(weight_results_dir, 'buy.json'), 'w') as f:
            json.dump(assets_to_buy_list, f)

        with open(os.path.join(weight_results_dir, 'sell.json'), 'w') as f:
            json.dump(assets_to_sell_list, f)    

        # Get the last two rows and convert the timestamp to your timezone
        last_two_rows = weights_df.tail(2)
        last_two_rows.index = last_two_rows.index.tz_localize('UTC').tz_convert('Europe/Paris')

        # Return the most recent weights as JSON
        recent_weights_json = last_two_rows.tail(1).to_json(orient='index')
        return recent_weights_json


if __name__ == '__main__':
    output_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.realpath(__file__))
    print(main(output_dir))