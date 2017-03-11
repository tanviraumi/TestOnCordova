/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
(function() {
    "use strict";

    var client, // Connection to the Azure Mobile App backend
        store,  // Sqlite store to use for offline data sync
        syncContext, // Offline data sync context
        tableName = 'todoitem',
        todoItemTable; // Reference to a table endpoint on backend

    // Set useOfflineSync to true to use tables from local store.
    // Set useOfflineSync to false to use tables on the server.
    var useOfflineSync = true;



    // The ADAL Settings
    var adal = {
        authority: 'https://login.windows.net/common',
        resourceUri: 'https://testoncordova.azurewebsites.net',
        redirectUri: 'https://testoncordova.azurewebsites.net/.auth/login/done',
        clientId: '7c87d5bc-5721-4e0d-8464-44a7120a8e6e'
    };


    // Add an event listener to call our initialization routine when the host is ready
    document.addEventListener('deviceready', onDeviceReady, false);

    /**
     * Event Handler, called when the host is ready
     *
     * @event
     */
    function onDeviceReady() {
        // Create a connection reference to our Azure Mobile Apps backend 
        client = new WindowsAzure.MobileServiceClient('https://testoncordova.azurewebsites.net');

        if (useOfflineSync) {
            initializeStore().then(setup);
        } else {
            setup();
        }
        registerForPushNotifications();

        // Wire up the button to initialize the application
        $('#loginButton').on('click', function (event) {
            event.preventDefault();
            /*
            authenticate(function (data) {
                console.log(data.accessToken);
                client.login('aad', { 'access_token': data.accessToken })
                .then(initializeApp, function (error) {
                    console.error(error);
                    alert('Failed to authenticate to ZUMO!');
                });
            });*/
            /*
            client.login('facebook').then(initializeApp, function (error) {
                console.error('Auth failed: ', error);
                alert('Failed to login!');
            });*/

            /*
            client.login('facebook')
                .then(function () {
                    callAuthMe(function (result) {
                        // Log User ID from output
                        console.log('user Id: ', result[0]["user_id"]);
                        var userid = result[0]["user_id"];
                        console.log(userid);
                        initializeApp();
                    },
                    function (msg) {
                        console.error(msg);
                    });
                }, function (msg) {
                    console.error(msg);
                });*/

                var fbLoginSuccess = function (userData) {
                    console.log("UserInfo: ", userData);
                    facebookConnectPlugin.getAccessToken(function (token) {
                        console.log("Token: " + token);
                        client.login('facebook', { 'access_token': token })
                        .then(initializeApp, function (error) {
                            console.error(error);
                            alert('Failed to authenticate to ZUMO!');
                        });
                    });
                }

                facebookConnectPlugin.login(["public_profile"], fbLoginSuccess,
                  function (error) {
                      console.error(error)
                  }
                );

            });
    }


    function callAuthMe(successCallback, failCallback) {
        var req = new XMLHttpRequest();
        req.open("GET", "https://testoncordova.azurewebsites.net/.auth/me", true);

        // Here's the secret sauce: X-ZUMO-AUTH
        req.setRequestHeader('X-ZUMO-AUTH', client.currentUser.mobileServiceAuthenticationToken);

        req.onload = function (e) {
            if (e.target.status >= 200 && e.target.status < 300) {
                successCallback(JSON.parse(e.target.response));
                return;
            }
            failCallback('Data request failed. Status ' + e.target.status + ' ' + e.target.response);
        };

        req.onerror = function (e) {
            failCallback('Data request failed: ' + e.error);
        }
        req.send();
    }



    /**
        * Authenticate with the ADAL Plugin
        * @param {function} authCompletedCallback the function to call when complete
    */
    function authenticate(authCompletedCallback) {
        console.log("Start Auth.......");
        adal.context = new Microsoft.ADAL.AuthenticationContext(adal.authority);
        console.log("Setting up ADAL.......");
        adal.context.tokenCache.readItems().then(function (items) {
            console.log("Reading cache");
            if (items.length > 0) {
                console.log("Item has stuff");
                adal.authority = items[0].authority;
                adal.context = new Microsoft.ADAL.AuthenticationContext(adal.authority);
            }

            // Attempt to authorize user silently
            adal.context.acquireTokenSilentAsync(adal.resourceUri, adal.clientId)
            .then(authCompletedCallback, function (p) {
                console.log(adal.resourceUri);
                // We require user cridentials so triggers authentication dialog
                adal.context.acquireTokenAsync(adal.resourceUri, adal.clientId, adal.redirectUri)
                .then(authCompletedCallback, function (err) {
                    console.error('Failed to authenticate via ADAL: ', err);
                    alert("Failed to authenticate: " + err);
                });
            });
        });
    }




    // Register for Push Notifications. Requires that phonegap-plugin-push be installed.
    var pushRegistration = null;
    function registerForPushNotifications() {
        pushRegistration = PushNotification.init({
            android: { senderID: '40201669292' },
            ios: { alert: 'true', badge: 'true', sound: 'true' },
            wns: {}
        });

        // Handle the registration event.
        pushRegistration.on('registration', function (data) {
            // Get the native platform of the device.
            var platform = device.platform;
            // Get the handle returned during registration.
            var handle = data.registrationId;
            // Set the device-specific message template.
            if (platform == 'android' || platform == 'Android') {
                // Register for GCM notifications.
                console.log("Register for push notification");
                client.push.register('gcm', handle, {
                    mytemplate: { body: { data: { message: "{$(messageParam)}", table: "{$(tableParam)}" } }, tags: ["tanviraumi@gmail.com"] }
                }).then(function (data) {
                    console.log("success: " + data);
                }, function (error) {
                    console.log(error);
                });
                //client.push.register('gcm', handle);
            } else if (device.platform === 'iOS') {
                // Register for notifications.
                client.push.register('apns', handle, {
                    mytemplate: { body: { aps: { alert: "{$(messageParam)}" } } }
                });
            } else if (device.platform === 'windows') {
                // Register for WNS notifications.
                client.push.register('wns', handle, {
                    myTemplate: {
                        body: '<toast><visual><binding template="ToastText01"><text id="1">$(messageParam)</text></binding></visual></toast>',
                        headers: { 'X-WNS-Type': 'wns/toast' }
                    }
                });
            }
        });
        console.log("Done setting up push");

        pushRegistration.on('notification', function (data, d2) {
            console.log("Push Received");
            var tableName = data.additionalData.table;
            alert('Push Received: ' + data.message);
        });

        pushRegistration.on('error', handleError);
    }



    /**
     * Set up and initialize the local store.
     */
    function initializeStore() {
        // Create the sqlite store
        store = new WindowsAzure.MobileServiceSqliteStore();

        // Define the table schema
        return store.defineTable({
            name: tableName,
            columnDefinitions: {
                id: 'string',
                deleted: 'boolean',
                text: 'string',
                complete: 'boolean',
                version: 'string'
            }
        }).then(function() {
            // Initialize the sync context
            syncContext = client.getSyncContext();

            // Define an overly simplified push handler that discards
            // local changes whenever there is an error or conflict.
            // Note that a real world push handler will have to take action according
            // to the nature of conflict.
            syncContext.pushHandler = {
                onConflict: function (pushError) {
                    return pushError.cancelAndDiscard();
                },
                onError: function (pushError) {
                    return pushError.cancelAndDiscard();
                }
            };

            return syncContext.initialize(store);
        });
    }
    
    /**
     * Set up the tables, event handlers and load data from the server 
     */
    function setup() {

        // Create a table reference
        if (useOfflineSync) {
            todoItemTable = client.getSyncTable(tableName);
        } else {
            todoItemTable = client.getTable(tableName);
        }

        // Refresh the todoItems
        //refreshDisplay();

        // Wire up the UI Event Handler for the Add Item
        //$('#add-item').submit(addItemHandler);
        //$('#refresh').on('click', refreshDisplay);
    }



    /**
 * Called after the entry button is clicked to clean up the old HTML and add our HTML
 */
    function initializeApp() {
        console.log('client.currentUser.userId: ', client.currentUser.userId);
        $('#wrapper').empty();

        // Replace the wrapper with the main content from the original Todo App
        var content =
              '<article>'
            + '  <header>'
            + '    <h2>Azure</h2><h1>Mobile Apps</h1>'
            + '    <form id="add-item">'
            + '      <button id="refresh">Refresh</button>'
            + '      <button id="add">Add</button>'
            + '      <div><input type="text" id="new-item-text" placeholder="Enter new task" /></div>'
            + '    </form>'
            + '  </header>'
            + '  <ul id="todo-items"></ul>'
            + '  <p id="summary">Initializing...</p>'
            + '</article>'
            + '<footer><ul id="errorlog"></ul></footer>';
        $('#wrapper').html(content);

        // Refresh the todoItems
        refreshDisplay();

        // Wire up the UI Event Handler for the Add Item
        $('#add').on('click', addItemHandler);
        $('#refresh').on('click', handleRefresh);
    }


    /**
    * Event handler for the refresh button
    * @event
    */
    function handleRefresh(event) {
        refreshDisplay();
        event.preventDefault();
    }



    /**
     * Refresh the display with items from the table.
     * If offline sync is enabled, the local table will be synchronized
     * with the server table before displaying the todo items.
     */
    function refreshDisplay() {
        updateSummaryMessage('Loading Data from Azure');

        if (useOfflineSync) {
            syncLocalTable().then(displayItems);
        } else {
            displayItems();
        }    
    }

    /**
     * Synchronize local table with the table on the server.
     * We do this by pushing local changes to the server and then
     * pulling the latest changes from the server.
     */
    function syncLocalTable() {
        return syncContext
                    .push()
                    .then(function() {
                        return syncContext.pull(new WindowsAzure.Query(tableName));
                    });
    }
    
    /**
     * Displays the todo items
     */
    function displayItems() {
        // Execute a query for uncompleted items and process
        todoItemTable
            .where({ complete: false })     // Set up the query
            .read()                         // Read the results
            .then(createTodoItemList, handleError);
    }
    
    /**
     * Updates the Summary Message
     * @param {string} msg the message to use
     * @returns {void}
     */
    function updateSummaryMessage(msg) {
        $('#summary').html(msg);
    }

    /**
     * Create the DOM for a single todo item
     * @param {Object} item the Todo Item
     * @param {string} item.id the ID of the item
     * @param {bool} item.complete true if the item is completed
     * @param {string} item.text the text value
     * @returns {jQuery} jQuery DOM object
     */
    function createTodoItem(item) {
        return $('<li>')
            .attr('data-todoitem-id', item.id)
            .append($('<button class="item-delete">Delete</button>'))
            .append($('<input type="checkbox" class="item-complete">').prop('checked', item.complete))
            .append($('<div>').append($('<input class="item-text">').val(item.text)));
    }

    /**
     * Create a list of Todo Items
     * @param {TodoItem[]} items an array of todoitem objects
     * @returns {void}
     */
    function createTodoItemList(items) {
        // Cycle through each item received from Azure and add items to the item list
        var listItems = $.map(items, createTodoItem);
        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        $('#summary').html('<strong>' + items.length + '</strong> item(s)');

        // Wire up the event handlers for each item in the list
        $('.item-delete').on('click', deleteItemHandler);
        $('.item-text').on('change', updateItemTextHandler);
        $('.item-complete').on('change', updateItemCompleteHandler);
    }

    /**
     * Handle error conditions
     * @param {Error} error the error that needs handling
     * @returns {void}
     */
    function handleError(error) {
        var text = error + (error.request ? ' - ' + error.request.status : '');
        console.error(text);
        $('#errorlog').append($('<li>').text(text));
    }

    /**
     * Given a sub-element of an LI, find the TodoItem ID associated with the list member
     *
     * @param {DOMElement} el the form element
     * @returns {string} the ID of the TodoItem
     */
    function getTodoItemId(el) {
        return $(el).closest('li').attr('data-todoitem-id');
    }

    /**
     * Event handler for when the user enters some text and clicks on Add
     * @param {Event} event the event that caused the request
     * @returns {void}
     */
    function addItemHandler(event) {
        var textbox = $('#new-item-text'),
            itemText = textbox.val();

        updateSummaryMessage('Adding New Item');
        if (itemText !== '') {
            todoItemTable.insert({
                text: itemText,
                complete: false
            }).then(displayItems, handleError);
        }
        console.log("Inserting item");
        textbox.val('').focus();
        event.preventDefault();
    }

    /**
     * Event handler for when the user clicks on Delete next to a todo item
     * @param {Event} event the event that caused the request
     * @returns {void}
     */
    function deleteItemHandler(event) {
        var itemId = getTodoItemId(event.currentTarget);

        updateSummaryMessage('Deleting Item in Azure');
        todoItemTable
            .del({ id: itemId })   // Async send the deletion to backend
            .then(displayItems, handleError); // Update the UI
        event.preventDefault();
    }

    /**
     * Event handler for when the user updates the text of a todo item
     * @param {Event} event the event that caused the request
     * @returns {void}
     */
    function updateItemTextHandler(event) {
        var itemId = getTodoItemId(event.currentTarget),
            newText = $(event.currentTarget).val();

        updateSummaryMessage('Updating Item in Azure');
        todoItemTable
            .update({ id: itemId, text: newText })  // Async send the update to backend
            .then(displayItems, handleError); // Update the UI
        event.preventDefault();
    }

    /**
     * Event handler for when the user updates the completed checkbox of a todo item
     * @param {Event} event the event that caused the request
     * @returns {void}
     */
    function updateItemCompleteHandler(event) {
        var itemId = getTodoItemId(event.currentTarget),
            isComplete = $(event.currentTarget).prop('checked');

        updateSummaryMessage('Updating Item in Azure');
        todoItemTable
            .update({ id: itemId, complete: isComplete })  // Async send the update to backend
            .then(displayItems, handleError);        // Update the UI
    }
})();