window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

Ext.define('CustomIndexedDB',{
    extend: 'Ext.data.proxy.Client',
    alternateClassName: 'Ext.data.DbEngineProxy',
    alias :'proxy.indexeddb',
    config:{
        databaseName: "QLDatabaseku",
        table: Math.random().toString(36).substr(2),
        dbprocess:false
    },
    constructor: function() {
        this.callParent(arguments);
        this.cache = {};
        if (this.getStorageObject() === undefined) {
            Ext.raise("INDEXED DB IS NOT SUPPORTED BY YOUR BROWSER");
        }
        this.initialize();
    },
    getStorageObject: function(){
        return window.indexedDB;
    },
    initialize: function() {
        console.log('SQL: DB proxy is being initialized....');
        var me = this;
        var request;
        request = window.indexedDB.open(me.config.databaseName);
        me.dbprocess=true;
        request.onerror = function(event) {
            me.dbprocess=false;            
            throw "SQL: db initializing was failed, DB could not be opened (no problem)";
        };

        request.onsuccess = function(event) {
            db = request.result;
            if( !( Array.from(db.objectStoreNames) ).includes(me.config.table) ){
                db.close();
                me.dbprocess=false;
                var secondRequest = indexedDB.open(db.name, db.version+1);
                secondRequest.onupgradeneeded = function (e) {
                    var db = e.target.result;
                    console.log("SQL: db "+db.name+" upgraded successfully to version:"+ db.version);
                    console.log("SQL: "+me.config.table+" table created");
                    db.createObjectStore(me.config.table, { autoIncrement : true });
                    db.close();
                    me.dbprocess=false;
                };
                secondRequest.onsuccess = function (e) {
                    console.log("SQL: NEW db "+ e.target.result.name+" opened/created successfully in version:"+  e.target.result.version);
                    e.target.result.close();
                    me.dbprocess=false;
                }
            }else{
                console.log("SQL: db "+db.name+" opened/created successfully in version:"+ db.version);
                db.close();
                me.dbprocess=false;
            }
        };

        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            db.createObjectStore(me.config.table, { autoIncrement : true });
            console.log("SQL: db "+db.name+" upgraded successfully to version:"+ db.version);
            console.log("SQL: "+me.config.table+" table created");
            db.close();
            me.dbprocess=false;
        }
    },

    create: function (operation) {
        
        var me = this,
            records = operation.getRecords(),
            totalRecords = records.length,
            data = [],
            createdRecords = [],
            result,store,transaction,result,db;
        var oRequest = indexedDB.open(me.config.databaseName);
        me.dbprocess=true;
        oRequest.onerror = function(event) {
            me.dbprocess=false;
            throw "SQL: INSERT was failed, DB could not be opened";
        };
        oRequest.onsuccess = function (e) {
            db = e.target.result;
            operation.setStarted();

            Ext.each(records, function (record) {  
                var query = db.transaction([me.config.table], "readwrite")
                    .objectStore(me.config.table)
                        .add(record.data);
                query.onsuccess = function(event) {
                    console.log("SQL: data has been added to "+me.config.table);
                };
                query.onerror = function(event) {
                    db.close();
                    throw "SQL: INSERT was failed, operation error";
                }

            });
            operation.setCompleted();
            operation.setSuccessful(true);
            db.close();
            me.dbprocess=false;
        }

        oRequest.onupgradeneeded = function(event) {
            db=event.target.result;
            db.close();
            me.dbprocess=false;
        }
    },

    read: function (operation) {
        var me = this;
            // records = operation.getRecords(),
        var  Model = me.getModel();
        var  filters = operation.getFilters();
        var  limit = operation.getLimit();
        var  page = operation.getPage();
        var passed = limit*(page-1);  
        var position = 0;      
        operation.setStarted();
        var allRecords = [];
        var db;
        var request = window.indexedDB.open(me.config.databaseName);
        me.dbprocess=true;
        request.onerror = function(event) {
            me.dbprocess=false;
            throw "SQL: SELECT was failed, DB could not be opened (tidak apa2 karena baru pertama kok)";
        };

        request.onsuccess = function(event) {
            position=position+1 ;
            db = request.result;
            if( !( Array.from(db.objectStoreNames) ).includes(me.config.table) ){
                db.close();
                me.dbprocess=false;
                throw('SQL: objectstore does not exist. (no problem)');
                // console.log('SQL: waiting for table: '+me.config.table+' is being created...');
                // return false;
            }
            var objectStore = db.transaction(me.config.table).objectStore(me.config.table);
            
            objectStore.openCursor().onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    var found = false;
                    cursor.value.id = cursor.key;
                    var row = cursor.value;
                    if(filters!=undefined){
                        if(filters.all!=undefined){
                            var keys = Object.keys( cursor.value );
                            for(let y=0;y<keys.length;y++){
                                if( !['id'].includes((keys[y]).toLowerCase())  && (( (row[keys[y]]).toString() ).toLowerCase()).includes ( ( filters.all ).toLowerCase() ) ){
                                    found = true;
                                    break;
                                }
                            }
                        }else{
                            var filterKeys =  Object.keys(filters);
                            var totalMatching = filterKeys.length;
                            for(let y=0;y<filterKeys.length;y++){
                                if( ((filters[ (filterKeys[y]).toLowerCase() ]).toString()).toLowerCase() ==  ((row[ (filterKeys[y]).toLowerCase() ]).toString()).toLowerCase() ){
                                    totalMatching--;
                                }
                            }
                            if(totalMatching==0){
                                found=true;
                            }
                        }
                    }else{
                        found = true;
                    }
                    if(found){
                        if(passed!=0){
                            passed = passed-1;
                        }else{
                            allRecords.push( new Model(cursor.value) );
                            limit = limit-1;
                        }
                    }
                    if(limit==0){
                        cursor.advance(1000);
                    }else{
                        cursor.continue();
                    }
                } else {
                    operation.setResultSet(new Ext.data.ResultSet({
                        records: allRecords,
                        total: allRecords.length,
                        loaded: true,
                    }));
                    operation.setSuccessful(true);
                    db.close();
                    me.dbprocess=false;
                }
            };
            db.close();
            me.dbprocess=false;
        };
    },

    clear: function() {
        var me = this;
        var db;
        var request = window.indexedDB.open(me.config.databaseName);
        me.dbprocess=true;
        request.onerror = function(event) {            
            throw "SQL: CLEAR was failed, DB could not be opened";
        };

        request.onsuccess = function(e) {
            db = e.target.result;
            var transaction = db.transaction([me.config.table], "readwrite");
            var objectStore = transaction.objectStore(me.config.table);            
            var objectStoreRequest = objectStore.clear();
            objectStoreRequest.onsuccess = function(event) {
                console.log("SQL: table "+me.config.objectStore+" was cleared!" );
            };    
            db.close();
            me.dbprocess=false;
        }
    },
    erase: function(operation){
        var me = this;
        var db;
        var request = window.indexedDB.open(me.config.databaseName);
        me.dbprocess=true;
        request.onerror = function(event) {
            me.dbprocess=false;
            throw "SQL: DELETE was failed, DB could not be opened";
        };

        request.onsuccess = function(e) {
            db = e.target.result;
            var transaction = db.transaction([me.config.table], "readwrite");
            var objectStore = transaction.objectStore(me.config.table);
            
            if(operation.getId()!=undefined ){
                var search = objectStore.get(operation.getId());
                search.onsuccess=function(e){
                    var deletion = objectStore.delete( operation.getId() );
                    deletion.onsuccess=function(e){
                        console.log('SQL: Data Deleted');
                    }
                    deletion.onerror=function(e){
                        throw "SQL: DELETE was failed, operation error";
                    }
                };
            }else{
                var where = Object.keys(operation.config)[0];                
                objectStore.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        if ( (cursor.value)[where] == (operation.config)[where]) {   
                            var deletion = objectStore.delete( cursor.key );
                                deletion.onsuccess=function(e){
                                    console.log('SQL: Data Deleted');
                                }
                                deletion.onerror=function(e){
                                    throw "SQL: DELETE was failed, operation error";
                                }
                        }
                        cursor.continue();
                    } else {
                        // console.log("Data Habis");
                        db.close();
                        me.dbprocess=false;
                    }
                };
            }
            if(me.dbprocess){
                db.close();
            }
            me.dbprocess=false;
        }
        operation.setSuccessful(true);
    },

    update:function(operation){
        
        var me = this;
        var db;
        var request = window.indexedDB.open(me.config.databaseName);
        request.onerror = function(event) {
            throw "SQL: UPDATE was failed, DB could not be opened";
        };

        request.onsuccess = function(e) {
            db = e.target.result;
            var transaction = db.transaction([me.config.table], "readwrite");
            var objectStore = transaction.objectStore(me.config.table);            

            if(operation.getId()!=undefined ){
                var search = objectStore.get(operation.getId());
                search.onsuccess=function(e){
                    var newData = {};
                    Ext.iterate(Object.keys(operation.config),function(key){
                        if( !['object','function','undefined'].includes( typeof ( (operation.config)[key]) ) ){
                            newData[key]= (operation.config)[key];
                        }
                    });
                    var updating = objectStore.put( newData, operation.getId() );
                    updating.onsuccess=function(e){
                        console.log('SQL: Data Updated Successfully');
                    }
                    updating.onerror=function(e){
                        throw "SQL: UPDATE was failed, operation error";
                    }
                };
            }else{
                db.close();
                me.dbprocess=false;
                throw "SQL: UPDATE was failed, key: [id] was needed as where!"
            }
            db.close();
            me.dbprocess=false;
        }
        operation.setSuccessful(true);
        me.read(operation);
    },
    destroy: function(operation){
        var me = this;
       me.erase(operation);
    },
    remove: function(data){
        console.log('terremove');
        aaakudata=data;
    },

    getIds: function() {
        return 'yes';
    },
    load: function(){
        console.log('load terpanggil');
    }
});
